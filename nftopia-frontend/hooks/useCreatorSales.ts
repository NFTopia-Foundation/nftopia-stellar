"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/stores/auth-store";
import {
  getAllAuctions,
  getAllListings,
} from "@/lib/services/marketplace";
import {
  buildActivityFeed,
  deriveSalesSummary,
} from "@/lib/services/marketplace-mapper";
import type { MarketplaceActivity, SalesSummary } from "@/types/marketplace";

interface UseCreatorSalesResult {
  summary: SalesSummary | null;
  activity: MarketplaceActivity[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Loads the creator's listings and auctions, then derives the Sales-page view
 * model — summary tiles and a unified recent-activity feed — using the shared
 * mapper. All metrics are deterministically derived; see
 * `deriveSalesSummary` for the documented derivations.
 *
 * Powers the "Sales" page.
 */
export function useCreatorSales(): UseCreatorSalesResult {
  const { user } = useAuth();
  const creatorId = user?.id ?? null;

  const [summary, setSummary] = useState<SalesSummary | null>(null);
  const [activity, setActivity] = useState<MarketplaceActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!creatorId) return;
    setLoading(true);
    setError(null);
    try {
      const [listings, auctions] = await Promise.all([
        getAllListings(),
        getAllAuctions(),
      ]);
      setSummary(deriveSalesSummary(listings, auctions, creatorId));
      setActivity(buildActivityFeed(listings, auctions, creatorId));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load sales data.",
      );
    } finally {
      setLoading(false);
    }
  }, [creatorId]);

  useEffect(() => {
    if (creatorId) {
      void load();
    }
  }, [creatorId, load]);

  return { summary, activity, loading, error, refetch: load };
}
