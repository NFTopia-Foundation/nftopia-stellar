"use client";

import { useCallback, useEffect, useState } from "react";
import { acceptOffer, fetchNftOffers, type MarketplaceOffer } from "@/lib/api/offers";

export function useNftOffers(nftId: string | null | undefined) {
  const [offers, setOffers] = useState<MarketplaceOffer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!nftId) return;
    setLoading(true);
    setError(null);
    try {
      const list = await fetchNftOffers(nftId);
      setOffers(list.filter((o) => o.status === "active" || !o.status));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load offers");
      setOffers([]);
    } finally {
      setLoading(false);
    }
  }, [nftId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const accept = useCallback(
    async (offerId: string) => {
      setAcceptingId(offerId);
      setError(null);
      try {
        await acceptOffer(offerId);
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Accept failed");
        throw e;
      } finally {
        setAcceptingId(null);
      }
    },
    [refresh],
  );

  return { offers, loading, error, refresh, accept, acceptingId };
}
