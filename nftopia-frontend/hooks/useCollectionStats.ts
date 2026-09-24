"use client";

import { useState, useEffect } from "react";
import { API_CONFIG } from "@/lib/config";
import { calculateTrend, TrendDirection } from "@/components/collection/FloorPriceDisplay";

export interface CollectionStatRow {
  id?: string;
  collectionId: string;
  date: string;
  volume: string | number;
  floorPrice: string | number;
  salesCount: number;
}

export interface UseCollectionStatsResult {
  stats: CollectionStatRow[];
  historicalPrices: number[];
  trendPercentage: number | null;
  trendDirection: TrendDirection;
  loading: boolean;
  error: Error | null;
}

export function useCollectionStats(
  collectionId?: string,
  currentFloorPrice?: string | number | null
): UseCollectionStatsResult {
  const [stats, setStats] = useState<CollectionStatRow[]>([]);
  const [loading, setLoading] = useState<boolean>(Boolean(collectionId));
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!collectionId) {
      setStats([]);
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    async function fetchStats() {
      try {
        const res = await fetch(`${API_CONFIG.baseUrl}/collections/${collectionId}/stats`);
        if (!res.ok) {
          throw new Error(`Failed to fetch collection stats: ${res.status}`);
        }
        const data = await res.json();
        if (isMounted) {
          const statsArray: CollectionStatRow[] = Array.isArray(data)
            ? data
            : data?.data && Array.isArray(data.data)
            ? data.data
            : [];
          setStats(statsArray);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchStats();

    return () => {
      isMounted = false;
    };
  }, [collectionId]);

  // Extract floor prices in chronological order
  const historicalPrices: number[] = stats
    .map((s) => {
      const p = typeof s.floorPrice === "number" ? s.floorPrice : parseFloat(s.floorPrice);
      return Number.isNaN(p) ? null : p;
    })
    .filter((p): p is number => p !== null);

  const currentPriceNum =
    currentFloorPrice !== undefined && currentFloorPrice !== null
      ? typeof currentFloorPrice === "number"
        ? currentFloorPrice
        : parseFloat(currentFloorPrice)
      : undefined;

  const { percentage: trendPercentage, direction: trendDirection } = calculateTrend(
    historicalPrices,
    currentPriceNum
  );

  return {
    stats,
    historicalPrices,
    trendPercentage,
    trendDirection,
    loading,
    error,
  };
}
