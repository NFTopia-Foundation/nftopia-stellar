import { convertToFiat } from '@/src/utils/formatCurrency';

/**
 * XLM / asset ↔ fiat price service.
 *
 * Fetches exchange rates (default source: CoinGecko's public simple-price
 * endpoint), caches them with a short TTL, exposes a staleness flag so the UI
 * can warn when rates are old, and degrades gracefully (never throws) when the
 * network or the API is unavailable.
 */

export type AssetPriceMap = Record<string, Record<string, number>>;

export interface PriceQuote {
  /** Asset the quote is for, uppercase, e.g. `XLM`. */
  assetCode: string;
  /** Fiat/quote currency, uppercase, e.g. `USD`. */
  currency: string;
  /** Fiat units per one unit of the asset. */
  rate: number;
  /** Epoch milliseconds when the rate was fetched. */
  fetchedAt: number;
  /** Endpoint the rate came from. */
  source: string;
  /** True when the quote is older than the freshness threshold. */
  isStale: boolean;
}

export interface PriceServiceConfig {
  /** Injectable fetch (defaults to the global). */
  fetchImpl?: typeof fetch;
  /** Override the price endpoint. */
  endpoint?: string;
  /** Cache TTL; within this window cached data is served without a refresh. */
  ttlMs?: number;
  /** Age after which a quote is flagged stale. */
  staleThresholdMs?: number;
  /** Injectable clock (epoch ms). */
  now?: () => number;
  /** Mapping of asset code → CoinGecko id. */
  assetIds?: Record<string, string>;
}

/** Cached rates are considered fresh for one minute. */
export const DEFAULT_TTL_MS = 60_000;
/** Cached rates older than five minutes are flagged as stale. */
export const DEFAULT_STALE_THRESHOLD_MS = 5 * 60_000;
export const DEFAULT_PRICE_ENDPOINT =
  'https://api.coingecko.com/api/v3/simple/price';

/** Assets we know how to price out of the box. */
export const DEFAULT_ASSET_IDS: Record<string, string> = {
  XLM: 'stellar',
  USDC: 'usd-coin',
  USDT: 'tether',
};

/** Currencies offered by the Settings currency selector. */
export const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP', 'NGN'] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

const cache = new Map<string, PriceQuote>();
const inFlight = new Map<string, Promise<PriceQuote | null>>();

function normalizeAssetCode(assetCode: string): string {
  return assetCode.trim().toUpperCase();
}

function normalizeCurrency(currency: string): string {
  return currency.trim().toUpperCase();
}

function cacheKey(assetCode: string, currency: string): string {
  return `${assetCode}:${currency}`;
}

function resolveEndpoint(config: PriceServiceConfig): string {
  return (
    config.endpoint ||
    process.env.EXPO_PUBLIC_PRICE_API_URL ||
    DEFAULT_PRICE_ENDPOINT
  );
}

function buildUrl(
  endpoint: string,
  assetIds: Record<string, string>,
  assetCodes: string[],
  currencies: string[]
): string {
  const ids = Array.from(
    new Set(
      assetCodes
        .map((code) => assetIds[normalizeAssetCode(code)])
        .filter((id): id is string => Boolean(id))
    )
  ).join(',');

  const vs = Array.from(new Set(currencies.map((c) => normalizeCurrency(c).toLowerCase()))).join(',');

  const separator = endpoint.includes('?') ? '&' : '?';
  return `${endpoint}${separator}ids=${encodeURIComponent(ids)}&vs_currencies=${encodeURIComponent(vs)}`;
}

/**
 * Low-level fetch. Resolves to `null` on any non-2xx response, malformed body
 * or network error so callers can fall back to cached data.
 */
export async function fetchAssetRates(
  assetCodes: string[],
  currencies: string[],
  config: PriceServiceConfig = {}
): Promise<AssetPriceMap | null> {
  const fetchImpl = config.fetchImpl ?? fetch;
  const assetIds = { ...DEFAULT_ASSET_IDS, ...(config.assetIds ?? {}) };
  const endpoint = resolveEndpoint(config);

  const normalizedAssets = assetCodes.map(normalizeAssetCode);
  const normalizedCurrencies = currencies.map(normalizeCurrency);

  const pricedAssets = normalizedAssets.filter((code) => assetIds[code]);
  if (pricedAssets.length === 0 || normalizedCurrencies.length === 0) return null;

  try {
    const res = await fetchImpl(buildUrl(endpoint, assetIds, pricedAssets, normalizedCurrencies), {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;

    const data = (await res.json()) as Record<string, Record<string, unknown>> | null;
    if (!data || typeof data !== 'object') return null;

    const result: AssetPriceMap = {};
    for (const code of pricedAssets) {
      const raw = data[assetIds[code]];
      if (!raw || typeof raw !== 'object') continue;

      const rates: Record<string, number> = {};
      for (const currency of normalizedCurrencies) {
        const value = raw[currency.toLowerCase()];
        if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
          rates[currency] = value;
        }
      }
      if (Object.keys(rates).length > 0) result[code] = rates;
    }

    return Object.keys(result).length > 0 ? result : null;
  } catch {
    return null;
  }
}

/**
 * Fetches and caches a single quote, de-duplicating concurrent requests for the
 * same asset/currency pair.
 */
export function refreshAssetPrice(
  assetCode: string,
  currency: string,
  config: PriceServiceConfig = {}
): Promise<PriceQuote | null> {
  const asset = normalizeAssetCode(assetCode);
  const cur = normalizeCurrency(currency);
  const key = cacheKey(asset, cur);

  const existing = inFlight.get(key);
  if (existing) return existing;

  const promise = (async (): Promise<PriceQuote | null> => {
    try {
      const rates = await fetchAssetRates([asset], [cur], config);
      const rate = rates?.[asset]?.[cur];
      if (rate === undefined) return null;

      const quote: PriceQuote = {
        assetCode: asset,
        currency: cur,
        rate,
        fetchedAt: (config.now ?? Date.now)(),
        source: resolveEndpoint(config),
        isStale: false,
      };
      cache.set(key, quote);
      return quote;
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, promise);
  return promise;
}

/**
 * Returns a quote for `assetCode` in `currency`.
 *
 * - Fresh cache (age ≤ TTL) is returned immediately.
 * - Stale cache is returned immediately and refreshed in the background.
 * - With no cache, the network is awaited; `null` is returned on failure.
 *
 * Never throws.
 */
export async function getAssetPrice(
  assetCode: string,
  currency: string,
  config: PriceServiceConfig = {}
): Promise<PriceQuote | null> {
  const asset = normalizeAssetCode(assetCode);
  const cur = normalizeCurrency(currency);
  const key = cacheKey(asset, cur);
  const now = (config.now ?? Date.now)();
  const ttlMs = config.ttlMs ?? DEFAULT_TTL_MS;
  const staleThresholdMs = config.staleThresholdMs ?? DEFAULT_STALE_THRESHOLD_MS;

  const cached = cache.get(key);
  if (cached) {
    const age = now - cached.fetchedAt;
    if (age <= ttlMs) {
      return { ...cached, isStale: false };
    }

    // Return the old value right away and refresh in the background.
    void refreshAssetPrice(asset, cur, config);
    return { ...cached, isStale: age > staleThresholdMs };
  }

  return refreshAssetPrice(asset, cur, config);
}

/** Convenience wrapper for the native asset. */
export function getXlmPrice(
  currency = 'USD',
  config: PriceServiceConfig = {}
): Promise<PriceQuote | null> {
  return getAssetPrice('XLM', currency, config);
}

/** Converts an asset balance to fiat using a quote. Returns `null` when unknown. */
export function convertBalanceToFiat(
  amount: number | string | null | undefined,
  quote: PriceQuote | null | undefined
): number | null {
  return convertToFiat(amount, quote?.rate ?? null);
}

/** True when `fetchedAt` is older than the staleness threshold. */
export function isQuoteStale(
  fetchedAt: number,
  now = Date.now(),
  staleThresholdMs = DEFAULT_STALE_THRESHOLD_MS
): boolean {
  return now - fetchedAt > staleThresholdMs;
}

/** Removes every cached quote. Primarily used between tests. */
export function clearPriceCache(): void {
  cache.clear();
  inFlight.clear();
}

/** @internal test hook */
export function __getCachedQuote(assetCode: string, currency: string): PriceQuote | undefined {
  return cache.get(cacheKey(normalizeAssetCode(assetCode), normalizeCurrency(currency)));
}
