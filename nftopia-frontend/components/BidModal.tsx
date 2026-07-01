'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { X, Gavel, AlertCircle, Loader2, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useWalletStore } from '@/stores/walletStore';
import { usePlaceBidMutation } from '@/hooks/graphql/useMutations';
import { useToast } from '@/lib/stores';
import { cn } from '@/lib/utils';

interface BidModalProps {
  isOpen: boolean;
  onClose: () => void;
  auctionId: string;
  currentPrice: string;
  minBid: number;
  currency?: string;
  onBidSuccess?: () => void;
}

export function BidModal({
  isOpen,
  onClose,
  auctionId,
  currentPrice,
  minBid,
  currency = 'XLM',
  onBidSuccess,
}: BidModalProps) {
  const { connected, address } = useWalletStore();
  const { showSuccess, showError } = useToast();

  const [bidAmount, setBidAmount] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const [placeBid, { loading }] = usePlaceBidMutation();

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setBidAmount('');
      setError(null);
    }
  }, [isOpen]);

  const handleSubmit = useCallback(async () => {
    if (!connected) {
      showError('Please connect your wallet to place a bid');
      return;
    }

    const amount = parseFloat(bidAmount);
    if (isNaN(amount) || amount < minBid) {
      setError(`Minimum bid is ${minBid.toFixed(2)} ${currency}`);
      return;
    }

    setError(null);

    try {
      const { data } = await placeBid({
        variables: {
          input: {
            auctionId,
            amount,
          },
        },
      });

      if (data?.placeBid) {
        showSuccess(`Bid of ${amount} ${currency} placed successfully!`);
        onBidSuccess?.();
        onClose();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to place bid';
      setError(message);
      showError(message);
    }
  }, [bidAmount, minBid, currency, connected, auctionId, placeBid, onBidSuccess, onClose, showSuccess, showError]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md mx-4 bg-[#1E1A45] rounded-2xl border border-purple-900/30 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-purple-900/30">
          <div className="flex items-center gap-3">
            <Gavel className="h-5 w-5 text-purple-400" />
            <h2 className="text-xl font-bold text-white">Place Bid</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Current Price */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-purple-500/10 border border-purple-900/30">
            <span className="text-sm text-gray-400">Current Price</span>
            <span className="font-bold text-white">{currentPrice} {currency}</span>
          </div>

          {/* Minimum Bid */}
          <div className="text-sm text-gray-400">
            Minimum bid: <span className="font-medium text-white">{minBid.toFixed(2)} {currency}</span>
          </div>

          {/* Input */}
          <div className="relative">
            <Input
              type="number"
              value={bidAmount}
              onChange={(e) => {
                setBidAmount(e.target.value);
                setError(null);
              }}
              placeholder="Enter bid amount"
              min={minBid}
              step="0.01"
              className="w-full bg-gray-900/50 border-gray-700/50 text-white placeholder:text-gray-500 focus:border-purple-500/60 focus:ring-1 focus:ring-purple-500/40 h-12 pr-16"
              disabled={loading}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">
              {currency}
            </span>
          </div>

          {/* Error */}
          {error && (
            <Alert variant="destructive" className="bg-red-500/10 border-red-500/20 text-red-400">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Wallet Status */}
          {!connected && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-sm">
              <Wallet className="h-4 w-4" />
              <span>Please connect your wallet to place a bid</span>
            </div>
          )}

          {/* Submit */}
          <Button
            onClick={handleSubmit}
            disabled={!connected || !bidAmount || loading}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-xl font-semibold transition-all disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Placing Bid...
              </>
            ) : (
              <>
                <Gavel className="h-4 w-4 mr-2" />
                Place Bid
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}