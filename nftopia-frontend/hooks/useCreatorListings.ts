"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/stores/auth-store";
import {
  cancelListing as cancelListingRequest,
  createListing as createListingRequest,
  getListingByNft,
  getOwnedNfts,
} from "@/lib/services/marketplace";
import { toMarketplaceNft } from "@/lib/services/marketplace-mapper";
import type { CreateListingDto, MarketplaceNft } from "@/types/marketplace";

interface UseCreatorListingsResult {
  nfts: MarketplaceNft[];
  loading: boolean;
  error: string | null;
  /** True while the underlying creator id is still resolving. */
  isAuthReady: boolean;
  refetch: () => Promise<void>;
  createListing: (
    nft: MarketplaceNft,
    input: { price: number; currency: string; expiresAt?: string },
  ) => Promise<void>;
  cancelListing: (nft: MarketplaceNft) => Promise<void>;
}

/**
 * Loads the authenticated creator's owned NFTs and resolves each one's listing
 * state, then exposes create/cancel actions that keep the in-memory list in
 * sync via optimistic updates backed by a confirming refetch.
 *
 * Powers the "List NFTs for Sale" page.
 */
export function useCreatorListings(): UseCreatorListingsResult {
  const { user } = useAuth();
  const creatorId = user?.id ?? null;

  const [nfts, setNfts] = useState<MarketplaceNft[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!creatorId) return;
    setLoading(true);
    setError(null);
    try {
      const owned = await getOwnedNfts(creatorId);
      // Resolve listing state per NFT in parallel; a failed lookup degrades to
      // "not listed" rather than failing the whole page.
      const enriched = await Promise.all(
        owned.map(async (nft) => {
          try {
            const listing = await getListingByNft(nft.contractId, nft.tokenId);
            return toMarketplaceNft(nft, listing);
          } catch {
            return toMarketplaceNft(nft, null);
          }
        }),
      );
      setNfts(enriched);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load NFTs.");
    } finally {
      setLoading(false);
    }
  }, [creatorId]);

  useEffect(() => {
    if (creatorId) {
      void load();
    }
  }, [creatorId, load]);

  const createListing = useCallback(
    async (
      nft: MarketplaceNft,
      input: { price: number; currency: string; expiresAt?: string },
    ) => {
      const payload: CreateListingDto = {
        nftContractId: nft.contractId,
        nftTokenId: nft.tokenId,
        price: input.price,
        currency: input.currency,
        expiresAt: input.expiresAt,
      };
      const listing = await createListingRequest(payload);
      // Optimistically reflect the new active listing, then refetch to confirm.
      setNfts((prev) =>
        prev.map((item) =>
          item.nftKey === nft.nftKey
            ? { ...item, state: "ACTIVE", listing }
            : item,
        ),
      );
      await load();
    },
    [load],
  );

  const cancelListing = useCallback(
    async (nft: MarketplaceNft) => {
      if (!nft.listing) return;
      await cancelListingRequest(nft.listing.id);
      setNfts((prev) =>
        prev.map((item) =>
          item.nftKey === nft.nftKey
            ? { ...item, state: "NOT_LISTED", listing: null }
            : item,
        ),
      );
      await load();
    },
    [load],
  );

  return {
    nfts,
    loading,
    error,
    isAuthReady: creatorId !== null,
    refetch: load,
    createListing,
    cancelListing,
  };
}
