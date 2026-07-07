"use client";

import { useState } from "react";
import { useBuyNFTMutation } from "@/hooks/graphql/useMutations";
import { Button } from "@/components/ui/button";
import { OptimizedImage } from "@/components/image";
import { Loader2 } from "lucide-react";
import { useWalletStore } from "@/stores/walletStore";
import { useToast } from "@/lib/stores";
import { useRouter } from "next/navigation";

type PurchaseModalProps = {
  isOpen: boolean;
  onClose: () => void;
  listingId: string;
  nftName: string;
  nftImage: string;
  price: string;
  currency: string;
};

export function PurchaseModal({
  isOpen,
  onClose,
  listingId,
  nftName,
  nftImage,
  price,
  currency,
}: PurchaseModalProps) {
  const [buyNFT, { loading, error }] = useBuyNFTMutation();
  const [success, setSuccess] = useState(false);
  const { connected: isConnected } = useWalletStore();
  const router = useRouter();
  const { showSuccess, showError } = useToast();

  const handlePurchase = async () => {
    if (!isConnected) {
      showError("Please connect your wallet to proceed with purchase.");
      return;
    }
    
    try {
      const { data } = await buyNFT({ variables: { listingId } });
      if (data?.buyNFT?.success) {
        setSuccess(true);
        showSuccess(`You have successfully purchased ${nftName}!`);
        setTimeout(() => {
          router.push('/dashboard/collection');
        }, 2000);
      }
    } catch (err: any) {
      console.error("Purchase failed", err);
      showError(err.message || "An error occurred during purchase.");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1E1A45] rounded-2xl p-6 w-full max-w-md border border-purple-900/30">
        <h2 className="text-2xl font-bold mb-4">Complete Purchase</h2>
        
        {success ? (
          <div className="text-center py-8 space-y-4">
            <div className="text-green-400 text-xl font-semibold">Purchase Successful!</div>
            <p className="text-gray-300">You now own {nftName}</p>
            <p className="text-sm text-gray-500">Redirecting to your collection...</p>
            <Button onClick={onClose} className="w-full mt-4">Close</Button>
          </div>
        ) : (
          <>
            <div className="flex gap-4 mb-6 p-4 bg-black/20 rounded-xl">
              <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0">
                <OptimizedImage
                  src={nftImage}
                  alt={nftName}
                  width={80}
                  height={80}
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <h3 className="font-semibold text-lg">{nftName}</h3>
                <div className="text-purple-400 font-medium">
                  {price} {currency}
                </div>
              </div>
            </div>

            <div className="space-y-3 mb-6 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">NFT Price</span>
                <span>{price} {currency}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Platform Fee</span>
                <span>0.00 {currency}</span>
              </div>
              <div className="flex justify-between pt-3 border-t border-purple-900/30 font-semibold">
                <span>Total</span>
                <span className="text-purple-400">{price} {currency}</span>
              </div>
            </div>

            {error && (
              <div className="text-red-400 text-sm mb-4 p-3 bg-red-400/10 rounded-lg">
                {error.message || "Transaction failed. Please try again."}
              </div>
            )}

            <div className="flex gap-3">
              <Button 
                variant="outline" 
                onClick={onClose}
                className="flex-1 bg-transparent border-purple-900/50 hover:bg-purple-900/20"
                disabled={loading}
              >
                Cancel
              </Button>
              {!isConnected ? (
                <Button 
                  onClick={onClose} // Just close to let user trigger normal connect flow, or implement connect hook here
                  className="flex-1 bg-purple-600 hover:bg-purple-700"
                >
                  Connect Wallet First
                </Button>
              ) : (
                <Button 
                  onClick={handlePurchase}
                  className="flex-1 bg-purple-600 hover:bg-purple-700"
                  disabled={loading}
                >
                  {loading ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing</>
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
