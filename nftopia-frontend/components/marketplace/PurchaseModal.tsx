"use client";

import { useMemo, useState } from "react";
import { useBuyNFTMutation } from "@/hooks/graphql/useMutations";
import { Button } from "@/components/ui/button";
import { OptimizedImage } from "@/components/image";
import { Loader2 } from "lucide-react";
import { useWalletStore } from "@/stores/walletStore";
import { useToast } from "@/lib/stores";
import { useRouter } from "next/navigation";
import { TransactionFeePreview } from "@/components/wallet/TransactionFeePreview";
import { useWalletBalance } from "@/hooks/useWalletBalance";
import { PurchaseReceipt, type PurchaseReceiptData } from "@/components/marketplace/PurchaseReceipt";
import { useTransactionStore } from "@/lib/stores/transaction-store";
import type { StellarNetwork } from "@/types/stellar";

export type CheckoutStep = "review" | "sign" | "submit" | "confirmed" | "failed";

const STEPS: { id: CheckoutStep; label: string }[] = [
  { id: "review", label: "Review" },
  { id: "sign", label: "Sign in wallet" },
  { id: "submit", label: "Submitting" },
  { id: "confirmed", label: "Confirmed" },
];

type PurchaseModalProps = {
  isOpen: boolean;
  onClose: () => void;
  listingId: string;
  nftName: string;
  nftImage: string;
  price: string;
  currency: string;
  seller?: string;
  /** Estimated network fee in the same units as price; defaults to 0. */
  estimatedFee?: number;
  /** XLM base reserve buffer when paying with XLM. */
  xlmReserve?: number;
  locale?: string;
};

export function PurchaseModal({
  isOpen,
  onClose,
  listingId,
  nftName,
  nftImage,
  price,
  currency,
  seller,
  estimatedFee = 0,
  xlmReserve = 1,
  locale = "en",
}: PurchaseModalProps) {
  const [buyNFT, { loading }] = useBuyNFTMutation();
  const [step, setStep] = useState<CheckoutStep>("review");
  const [stepError, setStepError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<PurchaseReceiptData | null>(null);
  const { connected: isConnected, address, network } = useWalletStore() as {
    connected: boolean;
    address?: string;
    network?: StellarNetwork;
  };
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const { getBalance, loading: balanceLoading, error: balanceError } = useWalletBalance(
    isConnected ? address : null,
    network ?? "testnet",
  );

  const priceNum = useMemo(() => parseFloat(price) || 0, [price]);
  const required = useMemo(() => {
    const reserve = currency.toUpperCase() === "XLM" ? xlmReserve : 0;
    return priceNum + estimatedFee + reserve;
  }, [priceNum, estimatedFee, xlmReserve, currency]);

  const available = getBalance(currency);
  const insufficient =
    available != null && Number.isFinite(available) && available < required;
  const shortfall =
    insufficient && available != null ? Math.max(0, required - available) : 0;

  const resetFlow = () => {
    setStep("review");
    setStepError(null);
    setReceipt(null);
  };

  const handlePurchase = async () => {
    if (!isConnected) {
      showError("Please connect your wallet to proceed with purchase.");
      return;
    }
    if (insufficient) {
      showError(`Insufficient balance. Short by ${shortfall.toFixed(4)} ${currency}.`);
      return;
    }

    setStepError(null);
    setStep("sign");
    try {
      setStep("submit");
      const { data } = await buyNFT({ variables: { listingId } });
      if (data?.buyNFT?.success) {
        setStep("confirmed");
        // buyNFT's schema type is TransactionResult (success/listingId/buyerId);
        // a hash is not part of it, so read one defensively if the API adds it.
        const buyResult = data?.buyNFT as unknown as
          | { transactionHash?: string | null; txHash?: string | null }
          | undefined;
        const txHash = buyResult?.transactionHash ?? buyResult?.txHash ?? null;
        const receiptData: PurchaseReceiptData = {
          nftName,
          nftImage,
          price,
          currency,
          platformFee: "0.00",
          networkFee: estimatedFee ? String(estimatedFee) : "0.00",
          royalty: "0.00",
          seller,
          buyer: address,
          timestamp: new Date().toISOString(),
          txHash,
        };
        setReceipt(receiptData);
        // Track the purchase so its receipt stays viewable from the
        // transactions page (#757). Fall back to a local reference when the
        // API does not surface an on-chain hash.
        useTransactionStore.getState().addTransaction({
          hash: txHash ?? `purchase-${listingId}-${Date.now()}`,
          type: "buy",
          network: network ?? "testnet",
          status: "confirmed",
          submittedAt: receiptData.timestamp,
          updatedAt: receiptData.timestamp,
          receipt: receiptData,
        });
        showSuccess(`You have successfully purchased ${nftName}!`);
      } else {
        setStep("failed");
        setStepError("Submission was not confirmed. You can retry from this step.");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An error occurred during purchase.";
      console.error("Purchase failed", err);
      setStep("failed");
      // Heuristic stage labeling for the user
      const stage =
        step === "sign" || /sign|reject|denied|wallet/i.test(message)
          ? "Sign in wallet"
          : /submit|network|timeout|horizon/i.test(message)
            ? "Submitting"
            : "Confirmation";
      setStepError(`${stage} failed: ${message}`);
      showError(message);
    }
  };

  const goToCollection = () => {
    // Valid app route (not /dashboard/collection) (#754)
    router.push(`/${locale}/creator-dashboard/my-nfts`);
    onClose();
  };

  if (!isOpen) return null;

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  return (
    <div
      data-testid="purchase-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
    >
      <div className="w-full max-w-md rounded-2xl border border-purple-900/30 bg-[#1E1A45] p-6">
        <h2 className="mb-4 text-2xl font-bold">Complete Purchase</h2>

        {/* Stepper (#754) */}
        <ol
          data-testid="checkout-stepper"
          className="mb-6 flex justify-between gap-1 text-[10px] uppercase tracking-wide text-gray-500 sm:text-xs"
        >
          {STEPS.map((s, i) => {
            const active = s.id === step || (step === "failed" && i <= Math.max(stepIndex, 1));
            const done =
              step === "confirmed"
                ? true
                : step === "failed"
                  ? false
                  : i < stepIndex;
            return (
              <li
                key={s.id}
                data-testid={`checkout-step-${s.id}`}
                className={`flex-1 text-center ${
                  step === "failed" && s.id !== "confirmed"
                    ? "text-red-400"
                    : done || s.id === step
                      ? "text-purple-300"
                      : ""
                } ${active ? "font-semibold" : ""}`}
              >
                {s.label}
              </li>
            );
          })}
        </ol>

        {step === "confirmed" && receipt ? (
          <div className="space-y-4">
            <div className="text-center text-green-400 text-lg font-semibold">Purchase Successful!</div>
            <PurchaseReceipt receipt={receipt} />
            <Button data-testid="go-to-collection-btn" onClick={goToCollection} className="w-full bg-purple-600">
              View my NFTs
            </Button>
            <Button variant="outline" onClick={onClose} className="w-full">
              Close
            </Button>
          </div>
        ) : (
          <>
            <div className="mb-6 flex items-center gap-4">
              <div className="relative h-20 w-20 overflow-hidden rounded-xl bg-purple-900/30">
                <OptimizedImage src={nftImage} alt={nftName} fill className="object-cover" />
              </div>
              <div>
                <h3 className="text-lg font-medium">{nftName}</h3>
                <div className="font-medium text-purple-400">
                  {price} {currency}
                </div>
              </div>
            </div>

            <div className="mb-6 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">NFT Price</span>
                <span>
                  {price} {currency}
                </span>
              </div>
              <TransactionFeePreview compact />
              <div className="flex justify-between border-t border-purple-900/30 pt-3 font-semibold">
                <span>Total (est.)</span>
                <span className="text-purple-400">
                  {required.toFixed(4)} {currency}
                </span>
              </div>
            </div>

            {/* Balance pre-check (#755) */}
            {isConnected && (
              <div data-testid="balance-precheck" className="mb-4 text-sm">
                {balanceLoading && <p className="text-gray-400">Checking balance…</p>}
                {!balanceLoading && balanceError && (
                  <p className="text-amber-300" data-testid="balance-warning">
                    Could not verify balance ({balanceError}). You may proceed with caution.
                  </p>
                )}
                {!balanceLoading && insufficient && (
                  <p className="rounded-lg bg-red-400/10 p-3 text-red-400" role="alert">
                    Insufficient balance. Short by {shortfall.toFixed(4)} {currency}.
                  </p>
                )}
              </div>
            )}

            {step === "failed" && stepError && (
              <div className="mb-4 rounded-lg bg-red-400/10 p-3 text-sm text-red-400" role="alert">
                <p>{stepError}</p>
                <Button
                  data-testid="retry-purchase-btn"
                  className="mt-3 w-full bg-purple-600"
                  onClick={() => {
                    resetFlow();
                    void handlePurchase();
                  }}
                >
                  Retry
                </Button>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  resetFlow();
                  onClose();
                }}
                data-testid="cancel-purchase-btn"
                className="flex-1 border-purple-900/50 bg-transparent"
                disabled={loading && step !== "failed"}
              >
                Cancel
              </Button>
              {!isConnected ? (
                <Button onClick={onClose} className="flex-1 bg-purple-600 hover:bg-purple-700">
                  Connect Wallet First
                </Button>
              ) : (
                <Button
                  onClick={() => void handlePurchase()}
                  data-testid="confirm-purchase-btn"
                  className="flex-1 bg-purple-600 hover:bg-purple-700"
                  disabled={loading || insufficient || step === "submit" || step === "sign"}
                >
                  {loading || step === "sign" || step === "submit" ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {step === "sign" ? "Sign in wallet…" : "Submitting…"}
                    </>
                  ) : (
                    "Confirm Purchase"
                  )}
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
