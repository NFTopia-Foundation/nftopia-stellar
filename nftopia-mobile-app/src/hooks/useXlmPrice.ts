import { useEffect, useState } from 'react';
import { usePreferencesStore } from '@/stores/preferencesStore';
import { getCachedXlmPrice, refreshXlmPrice } from '@/src/services/stellar/priceService';
import { isPriceStale, shouldRefreshPrice, type PriceSnapshot } from '@/src/services/stellar/price';

export interface UseXlmPriceResult {
  /** Price of 1 XLM in the user's selected currency, or null if unavailable (first launch offline, API unreachable — degrade by hiding the fiat value, not erroring). */
  price: number | null;
  currency: string;
  /** True once the underlying snapshot has aged past the staleness threshold — show a "prices may be outdated" cue. False when there's no price at all (that's "unavailable", not "stale"). */
  stale: boolean;
  /** True only until the very first cache read resolves — kept brief and non-blocking so this never delays the Home screen's initial paint. */
  loading: boolean;
}

/**
 * Reacts to the user's currency preference (#470) and keeps an XLM/fiat
 * price available for display. Reads the cache first for an instant,
 * non-blocking paint, then kicks off a background refresh only if that
 * cached value has exceeded the short TTL — a fresh cache hit never
 * touches the network at all.
 */
export function useXlmPrice(): UseXlmPriceResult {
  const currency = usePreferencesStore((state) => state.currency);
  const [snapshot, setSnapshot] = useState<PriceSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    getCachedXlmPrice(currency).then((cached) => {
      if (cancelled) return;
      if (cached && cached.currency === currency) setSnapshot(cached);

      if (!shouldRefreshPrice(cached)) {
        setLoading(false);
        return;
      }

      refreshXlmPrice(currency).then((fresh) => {
        if (cancelled) return;
        if (fresh) setSnapshot(fresh);
        setLoading(false);
      });
    });

    return () => {
      cancelled = true;
    };
  }, [currency]);

  const currentSnapshot = snapshot && snapshot.currency === currency ? snapshot : null;

  return {
    price: currentSnapshot?.price ?? null,
    currency,
    stale: currentSnapshot ? isPriceStale(currentSnapshot) : false,
    loading,
  };
}
