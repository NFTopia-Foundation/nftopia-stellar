"use client";

import { useCallback, useEffect, useState } from "react";
import { acceptOffer, fetchNftOffers, type MarketplaceOffer } from "@/lib/api/offers";
import { useStellarTransaction } from "@/components/wallet/hooks/useStellarTransaction";
import { useWalletStore } from "@/stores/walletStore";

export function useNftOffers(nftId: string | null | undefined) {
  const [offers, setOffers] = useState<MarketplaceOffer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  const provider = useWalletStore((state) => state.provider);
  const network = useWalletStore((state) => state.network);
  const { signAndSubmit } = useStellarTransaction(provider, network, "other");

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
        const { transactionXdr } = await acceptOffer(offerId);
        // When on-chain settlement is enabled the backend returns an unsigned
        // Soroban XDR; route it through the wallet signing flow (the same path
        // used for mint/list/buy) before refreshing the offer list.
        if (transactionXdr) {
          await signAndSubmit(transactionXdr);
        }
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Accept failed");
        throw e;
      } finally {
        setAcceptingId(null);
      }
    },
    [refresh, signAndSubmit],
  );

  return { offers, loading, error, refresh, accept, acceptingId };
}
