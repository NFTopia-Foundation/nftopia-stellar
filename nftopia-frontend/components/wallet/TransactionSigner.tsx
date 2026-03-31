"use client";

import { useState } from "react";
import { X, AlertCircle, CheckCircle2, Loader2, ExternalLink } from "lucide-react";
import { useStellarTransaction } from "./hooks/useStellarTransaction";
import { useWalletStore } from "@/stores/walletStore";
import { getExplorerUrl } from "@/lib/stellar/network";

export type TransactionType = "mint" | "list" | "bid" | "buy" | "cancel";

interface TransactionSignerProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (txHash: string) => void;
  transactionXdr: string;
  type: TransactionType;
  description?: string;
}

const TYPE_LABELS: Record<TransactionType, string> = {
  mint: "Mint NFT",
  list: "List NFT for Sale",
  bid: "Place Bid",
  buy: "Purchase NFT",
  cancel: "Cancel Listing",
};

export function TransactionSigner({
  open,
  onClose,
  onSuccess,
  transactionXdr,
  type,
  description,
}: TransactionSignerProps) {
  const { provider, network, address } = useWalletStore();
  const { signing, submitting, txHash, error, signAndSubmit, clearState } =
    useStellarTransaction(provider, network);

  const [done, setDone] = useState(false);

  const handleSign = async () => {
    try {
      const hash = await signAndSubmit(transactionXdr);
      setDone(true);
      onSuccess?.(hash);
    } catch {
      // error displayed via hook state
    }
  };

  const handleClose = () => {
    clearState();
    setDone(false);
    onClose();
  };

  if (!open) return null;

  const isLoading = signing || submitting;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={!isLoading ? handleClose : undefined} />

      <div className="relative w-full max-w-sm rounded-2xl border border-purple-500/20 bg-gray-950/95 backdrop-blur-md shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-purple-500/10">
          <h2 className="text-lg font-semibold text-white">{TYPE_LABELS[type]}</h2>
          {!isLoading && (
            <button onClick={handleClose} className="text-gray-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/5">
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Status states */}
          {!done && !error && (
            <>
              {description && (
                <p className="text-sm text-gray-400">{description}</p>
              )}

              <div className="rounded-xl border border-purple-500/15 bg-purple-500/5 p-4 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Wallet</span>
                  <span className="font-mono text-gray-300">
                    {address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "—"}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Network</span>
                  <span className="text-gray-300 capitalize">{network}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Provider</span>
                  <span className="text-gray-300 capitalize">{provider || "—"}</span>
                </div>
              </div>

              {isLoading && (
                <div className="flex items-center justify-center gap-3 py-2">
                  <Loader2 className="h-5 w-5 text-purple-400 animate-spin" />
                  <span className="text-sm text-gray-300">
                    {signing ? "Waiting for wallet signature…" : "Submitting to Stellar…"}
                  </span>
                </div>
              )}
            </>
          )}

          {error && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-red-900/30 border border-red-500/30 text-red-300 text-sm">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {done && txHash && (
            <div className="text-center space-y-3 py-2">
              <CheckCircle2 className="h-12 w-12 text-green-400 mx-auto" />
              <p className="font-semibold text-white">Transaction Submitted!</p>
              <p className="text-xs text-gray-400 font-mono break-all">{txHash}</p>
              <a
                href={getExplorerUrl(network, txHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-purple-400 hover:text-purple-300"
              >
                View on Stellar Expert <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          )}
        </div>

        {/* Footer */}
        {!done && (
          <div className="px-6 pb-6 flex gap-3">
            <button
              onClick={handleClose}
              disabled={isLoading}
              className="flex-1 py-3 rounded-xl border border-border text-gray-300 hover:text-white hover:border-purple-500/40 transition-colors text-sm font-medium disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              onClick={handleSign}
              disabled={isLoading || !transactionXdr || !provider}
              className="flex-1 py-3 rounded-xl bg-gradient-to-r from-[#4e3bff] to-[#9747ff] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Confirm & Sign"
              )}
            </button>
          </div>
        )}

        {done && (
          <div className="px-6 pb-6">
            <button
              onClick={handleClose}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-[#4e3bff] to-[#9747ff] text-white text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}