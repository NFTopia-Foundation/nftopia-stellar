"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useNftOffers } from "@/hooks/useNftOffers";
import { Loader2 } from "lucide-react";

type Props = {
  nftId: string;
  isOwner: boolean;
};

export function IncomingOffersPanel({ nftId, isOwner }: Props) {
  const { offers, loading, error, accept, acceptingId, refresh } = useNftOffers(nftId);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleAccept = async (offerId: string) => {
    setLocalError(null);
    try {
      await accept(offerId);
      setConfirmId(null);
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : "Accept failed");
    }
  };

  return (
    <section
      data-testid="incoming-offers-panel"
      className="mt-8 rounded-2xl border border-purple-900/40 bg-[#1E1A45]/50 p-5"
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Offers</h2>
        <button type="button" onClick={() => void refresh()} className="text-xs text-purple-300">
          Refresh
        </button>
      </div>

      {loading && (
        <p className="flex items-center gap-2 text-sm text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading offers…
        </p>
      )}
      {(error || localError) && (
        <p className="text-sm text-red-400" role="alert">
          {localError || error}
        </p>
      )}
      {!loading && offers.length === 0 && (
        <p className="text-sm text-gray-500">No active offers yet.</p>
      )}

      <ul className="space-y-3">
        {offers.map((offer) => (
          <li
            key={offer.id}
            data-testid={`offer-row-${offer.id}`}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 px-4 py-3"
          >
            <div>
              <p className="font-medium text-white">
                {offer.amount} {offer.currency}
              </p>
              <p className="text-xs text-gray-400">
                From {offer.bidderDisplayName || offer.bidder.slice(0, 4) + "…" + offer.bidder.slice(-4)}
                {offer.expiresAt ? ` · expires ${new Date(offer.expiresAt).toLocaleString()}` : ""}
              </p>
            </div>
            {isOwner && (
              <div className="flex gap-2">
                {confirmId === offer.id ? (
                  <>
                    <Button
                      size="sm"
                      data-testid={`confirm-accept-${offer.id}`}
                      disabled={acceptingId === offer.id}
                      onClick={() => void handleAccept(offer.id)}
                      className="bg-emerald-600 hover:bg-emerald-700"
                    >
                      {acceptingId === offer.id ? "Signing…" : "Confirm accept"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setConfirmId(null)}>
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    data-testid={`accept-offer-${offer.id}`}
                    onClick={() => setConfirmId(offer.id)}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    Accept
                  </Button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
      {/* Counter-offer: no backend route — deferred (POST marketplace/offers as new offer). */}
    </section>
  );
}
