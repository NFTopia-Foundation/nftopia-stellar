import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePreferencesStore } from '@/stores/preferencesStore';
import { useOfflineStore } from '@/stores/offlineStore';
import { PriceQuote, getAssetPrice } from '@/src/services/stellar/priceService';

export interface UseAssetPricesResult {
  /** Quotes keyed by uppercase asset code. Missing/null entries are unpriced. */
  quotes: Record<string, PriceQuote | null>;
  /** True while a fetch is in flight. */
  isLoading: boolean;
  /** True when at least one displayed quote is past the freshness threshold. */
  hasStalePrice: boolean;
  /** True when no quote could be obtained at all. */
  error: string | null;
  /** Force a re-fetch (respects the service cache). */
  refresh: () => Promise<void>;
}

/**
 * Subscribes to the selected fiat currency from the preferences store and
 * resolves XLM/asset prices for the requested asset codes. Failures degrade to
 * missing quotes rather than throwing, so callers can simply hide fiat values.
 */
export function useAssetPrices(assetCodes: string[] = ['XLM']): UseAssetPricesResult {
  const currency = usePreferencesStore((s) => s.currency);
  const online = useOfflineStore((s) => s.isOnline);

  const codesKey = assetCodes
    .map((code) => code.trim().toUpperCase())
    .filter(Boolean)
    .join('|');

  const codes = useMemo(() => {
    const unique = new Set(codesKey.split('|').filter(Boolean));
    return Array.from(unique);
  }, [codesKey]);

  const [quotes, setQuotes] = useState<Record<string, PriceQuote | null>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    if (codes.length === 0) return;
    setIsLoading(true);
    setError(null);
    try {
      const entries = await Promise.all(
        codes.map(async (code) => [code, await getAssetPrice(code, currency)] as const)
      );
      if (!mounted.current) return;
      setQuotes((prev) => {
        const next = { ...prev };
        for (const [code, quote] of entries) {
          if (quote) next[code] = quote;
        }
        return next;
      });
      if (entries.every(([, quote]) => quote === null)) {
        setError('Unable to load prices');
      }
    } catch {
      if (mounted.current) setError('Unable to load prices');
    } finally {
      if (mounted.current) setIsLoading(false);
    }
  }, [codes, currency]);

  useEffect(() => {
    void load();
  }, [load, online]);

  const refresh = useCallback(async () => {
    await load();
  }, [load]);

  const hasStalePrice = Object.values(quotes).some((quote) => quote?.isStale);

  return { quotes, isLoading, hasStalePrice, error, refresh };
}

export interface UseXlmPriceResult {
  quote: PriceQuote | null;
  isLoading: boolean;
  isStale: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/** Convenience wrapper for the common single-asset case. */
export function useXlmPrice(): UseXlmPriceResult {
  const { quotes, isLoading, hasStalePrice, error, refresh } = useAssetPrices(['XLM']);
  return { quote: quotes.XLM ?? null, isLoading, isStale: hasStalePrice, error, refresh };
}
