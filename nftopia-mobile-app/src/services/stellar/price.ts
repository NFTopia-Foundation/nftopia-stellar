/**
 * Pure XLM/fiat conversion and cache-freshness math for #470. Kept free of
 * network/storage/UI dependencies so it's trivial to unit test in
 * isolation — priceService.ts wires these to a real fetch + AsyncStorage.
 */

export interface PriceSnapshot {
  /** ISO 4217 currency code this price is denominated in, e.g. 'USD'. */
  currency: string;
  /** Price of 1 XLM in `currency`. */
  price: number;
  /** When this snapshot was fetched, as epoch ms. */
  fetchedAt: number;
}

/** How often a background refresh is attempted once a snapshot ages past this. */
export const PRICE_CACHE_TTL_MS = 60 * 1000; // 1 minute

/** Beyond this age, a snapshot is flagged stale for display purposes even if it's still the best data available. */
export const PRICE_STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

/** AsyncStorage key prefix for cached price snapshots — one entry per currency. */
export const PRICE_CACHE_KEY_PREFIX = '@nftopia/price_service/xlm_price/';

export function priceCacheKey(currency: string): string {
  return `${PRICE_CACHE_KEY_PREFIX}${currency.toLowerCase()}`;
}

/**
 * True once `snapshot` is old enough that it should no longer be presented
 * as current — the UI should show a "prices may be outdated" cue. A null
 * snapshot (no data at all) is not "stale", it's just absent; callers
 * distinguish the two cases separately (stale price vs. no price to show).
 */
export function isPriceStale(
  snapshot: Pick<PriceSnapshot, 'fetchedAt'>,
  now: number = Date.now(),
  thresholdMs: number = PRICE_STALE_THRESHOLD_MS,
): boolean {
  return now - snapshot.fetchedAt > thresholdMs;
}

/**
 * True when `snapshot` is missing or old enough to warrant a background
 * refresh attempt. Distinct from isPriceStale: the refresh threshold is
 * much shorter than the "tell the user this might be outdated" threshold,
 * so a snapshot can need refreshing well before it's actually stale.
 */
export function shouldRefreshPrice(
  snapshot: Pick<PriceSnapshot, 'fetchedAt'> | null,
  now: number = Date.now(),
  ttlMs: number = PRICE_CACHE_TTL_MS,
): boolean {
  if (!snapshot) return true;
  return now - snapshot.fetchedAt > ttlMs;
}

/**
 * Converts an asset amount to its fiat value at the given per-unit price.
 * Never throws: non-finite input (a malformed balance string, a missing
 * price) converts to 0 rather than NaN, since a conversion hiccup must not
 * be able to break rendering a balance that itself loaded fine.
 */
export function convertToFiat(assetAmount: string | number, pricePerUnit: number): number {
  const amount = typeof assetAmount === 'string' ? Number(assetAmount) : assetAmount;
  if (!Number.isFinite(amount) || !Number.isFinite(pricePerUnit)) return 0;
  return amount * pricePerUnit;
}
