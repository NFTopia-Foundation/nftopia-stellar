import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { PriceSnapshot, priceCacheKey, shouldRefreshPrice } from './price';

/**
 * Fetches and caches the XLM/fiat exchange rate (#470). Mirrors
 * lib/versionCheckService.ts's shape: an injectable fetchImpl for tests,
 * AsyncStorage-backed caching per currency, NetInfo-aware offline
 * handling, and null-on-failure everywhere so a price hiccup degrades
 * gracefully (hide the fiat value) rather than erroring the whole balance
 * display.
 *
 * Only XLM itself is priced here — arbitrary trustline assets have no
 * general price-feed solution (most aren't listed anywhere), so
 * per-token fiat conversion is left out of scope; BalanceDisplay shows
 * the fiat equivalent for the XLM line only.
 */

const COINGECKO_ENDPOINT = 'https://api.coingecko.com/api/v3/simple/price';
const COINGECKO_XLM_ID = 'stellar';

export interface PriceServiceConfig {
  fetchImpl?: typeof fetch;
  endpoint?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeSnapshot(currency: string, raw: unknown): PriceSnapshot | null {
  if (!isRecord(raw)) return null;
  const price = raw.price;
  const fetchedAt = raw.fetchedAt;
  if (typeof price !== 'number' || !Number.isFinite(price)) return null;
  if (typeof fetchedAt !== 'number' || !Number.isFinite(fetchedAt)) return null;
  return { currency, price, fetchedAt };
}

async function readCachedSnapshot(currency: string): Promise<PriceSnapshot | null> {
  try {
    const stored = await AsyncStorage.getItem(priceCacheKey(currency));
    if (!stored) return null;
    return normalizeSnapshot(currency, JSON.parse(stored));
  } catch {
    return null;
  }
}

async function writeCachedSnapshot(snapshot: PriceSnapshot): Promise<void> {
  try {
    await AsyncStorage.setItem(priceCacheKey(snapshot.currency), JSON.stringify(snapshot));
  } catch {
    // Best-effort; a caching failure shouldn't surface to the caller — the
    // fetched price is still returned for this call, it just won't be
    // cached for next time.
  }
}

async function isNetworkAvailable(): Promise<boolean> {
  try {
    const state = await NetInfo.fetch();
    return state.isConnected !== false && state.isInternetReachable !== false;
  } catch {
    // If NetInfo itself is unavailable, proceed and let fetch fail softly.
    return true;
  }
}

async function fetchXlmPriceFromApi(
  currency: string,
  fetchImpl: typeof fetch,
  endpoint: string,
): Promise<number | null> {
  try {
    const vsCurrency = currency.toLowerCase();
    const url = `${endpoint}?ids=${COINGECKO_XLM_ID}&vs_currencies=${encodeURIComponent(vsCurrency)}`;
    const res = await fetchImpl(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const data = await res.json();
    const price = isRecord(data) && isRecord(data[COINGECKO_XLM_ID])
      ? (data[COINGECKO_XLM_ID] as Record<string, unknown>)[vsCurrency]
      : undefined;
    return typeof price === 'number' && Number.isFinite(price) ? price : null;
  } catch {
    return null;
  }
}

/** Cache-only read — never touches the network. Used for an instant, non-blocking first paint before a background refresh (if needed) resolves. */
export async function getCachedXlmPrice(currency: string): Promise<PriceSnapshot | null> {
  return readCachedSnapshot(currency);
}

/**
 * Always attempts a fresh fetch (subject to connectivity) and caches the
 * result. Returns null — never throws — when offline or the API is
 * unreachable/malformed, so callers can fall back to whatever's cached.
 */
export async function refreshXlmPrice(
  currency: string,
  config: PriceServiceConfig = {},
): Promise<PriceSnapshot | null> {
  const fetchImpl = config.fetchImpl ?? fetch;
  const endpoint = config.endpoint ?? COINGECKO_ENDPOINT;

  if (!(await isNetworkAvailable())) return null;

  const price = await fetchXlmPriceFromApi(currency, fetchImpl, endpoint);
  if (price === null) return null;

  const snapshot: PriceSnapshot = { currency, price, fetchedAt: Date.now() };
  await writeCachedSnapshot(snapshot);
  return snapshot;
}

/**
 * High-level entry point: returns the cached snapshot immediately if it's
 * still within the TTL, otherwise attempts a refresh and falls back to
 * the (possibly stale, possibly absent) cached value if that refresh
 * fails. Never throws.
 */
export async function getXlmPrice(
  currency: string,
  config: PriceServiceConfig = {},
): Promise<PriceSnapshot | null> {
  const cached = await getCachedXlmPrice(currency);
  if (!shouldRefreshPrice(cached)) {
    return cached;
  }
  const fresh = await refreshXlmPrice(currency, config);
  return fresh ?? cached;
}
