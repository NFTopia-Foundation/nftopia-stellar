// ── Mocks (must be hoisted before imports) ───────────────────────────────────
const asyncStorageStore: Record<string, string> = {};

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn((key: string) => Promise.resolve(asyncStorageStore[key] ?? null)),
  setItem: jest.fn((key: string, value: string) => {
    asyncStorageStore[key] = value;
    return Promise.resolve();
  }),
  removeItem: jest.fn((key: string) => {
    delete asyncStorageStore[key];
    return Promise.resolve();
  }),
}));

const mockNetInfo = { fetch: jest.fn() };
jest.mock('@react-native-community/netinfo', () => ({
  fetch: (...args: unknown[]) => mockNetInfo.fetch(...args),
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────
import { getCachedXlmPrice, getXlmPrice, refreshXlmPrice } from '../priceService';
import { priceCacheKey, PRICE_CACHE_TTL_MS } from '../price';

function jsonOk(body: unknown) {
  return { ok: true, status: 200, json: async () => body } as Response;
}

describe('priceService', () => {
  beforeEach(() => {
    Object.keys(asyncStorageStore).forEach((k) => delete asyncStorageStore[k]);
    mockNetInfo.fetch.mockReset();
    mockNetInfo.fetch.mockResolvedValue({ isConnected: true, isInternetReachable: true });
    jest.clearAllMocks();
    mockNetInfo.fetch.mockResolvedValue({ isConnected: true, isInternetReachable: true });
  });

  describe('getCachedXlmPrice', () => {
    it('returns null when nothing is cached', async () => {
      expect(await getCachedXlmPrice('USD')).toBeNull();
    });

    it('returns the cached snapshot for that currency', async () => {
      asyncStorageStore[priceCacheKey('USD')] = JSON.stringify({ price: 0.12, fetchedAt: 1000 });
      expect(await getCachedXlmPrice('USD')).toEqual({ currency: 'USD', price: 0.12, fetchedAt: 1000 });
    });

    it('keeps currencies cached separately', async () => {
      asyncStorageStore[priceCacheKey('USD')] = JSON.stringify({ price: 0.12, fetchedAt: 1000 });
      asyncStorageStore[priceCacheKey('EUR')] = JSON.stringify({ price: 0.11, fetchedAt: 1000 });
      expect((await getCachedXlmPrice('USD'))?.price).toBe(0.12);
      expect((await getCachedXlmPrice('EUR'))?.price).toBe(0.11);
    });

    it('returns null for a malformed cache entry rather than throwing', async () => {
      asyncStorageStore[priceCacheKey('USD')] = 'not json';
      await expect(getCachedXlmPrice('USD')).resolves.toBeNull();
    });

    it('returns null when the cached shape is missing required fields', async () => {
      asyncStorageStore[priceCacheKey('USD')] = JSON.stringify({ price: 0.12 }); // no fetchedAt
      expect(await getCachedXlmPrice('USD')).toBeNull();
    });
  });

  describe('refreshXlmPrice', () => {
    it('fetches, caches, and returns a fresh snapshot', async () => {
      const fetchImpl = jest.fn().mockResolvedValue(jsonOk({ stellar: { usd: 0.15 } }));
      const snapshot = await refreshXlmPrice('USD', { fetchImpl });
      expect(snapshot?.price).toBe(0.15);
      expect(snapshot?.currency).toBe('USD');
      expect(JSON.parse(asyncStorageStore[priceCacheKey('USD')]).price).toBe(0.15);
    });

    it('lowercases the currency code for the CoinGecko vs_currencies param', async () => {
      const fetchImpl = jest.fn().mockResolvedValue(jsonOk({ stellar: { eur: 0.14 } }));
      await refreshXlmPrice('EUR', { fetchImpl });
      const [url] = fetchImpl.mock.calls[0] as [string];
      expect(url).toContain('vs_currencies=eur');
    });

    it('returns null on an HTTP error status', async () => {
      const fetchImpl = jest.fn().mockResolvedValue({ ok: false, status: 500 });
      expect(await refreshXlmPrice('USD', { fetchImpl })).toBeNull();
    });

    it('returns null on a network exception', async () => {
      const fetchImpl = jest.fn().mockRejectedValue(new Error('offline'));
      expect(await refreshXlmPrice('USD', { fetchImpl })).toBeNull();
    });

    it('returns null when the response is missing the requested currency (e.g. an unsupported code)', async () => {
      const fetchImpl = jest.fn().mockResolvedValue(jsonOk({ stellar: {} }));
      expect(await refreshXlmPrice('ZZZ', { fetchImpl })).toBeNull();
    });

    it('does not attempt a network call when offline', async () => {
      mockNetInfo.fetch.mockResolvedValue({ isConnected: false, isInternetReachable: false });
      const fetchImpl = jest.fn();
      expect(await refreshXlmPrice('USD', { fetchImpl })).toBeNull();
      expect(fetchImpl).not.toHaveBeenCalled();
    });

    it('does not cache a failed refresh', async () => {
      const fetchImpl = jest.fn().mockRejectedValue(new Error('offline'));
      await refreshXlmPrice('USD', { fetchImpl });
      expect(asyncStorageStore[priceCacheKey('USD')]).toBeUndefined();
    });
  });

  describe('getXlmPrice', () => {
    it('serves the cached snapshot without hitting the network when within the TTL', async () => {
      asyncStorageStore[priceCacheKey('USD')] = JSON.stringify({ price: 0.12, fetchedAt: Date.now() });
      const fetchImpl = jest.fn();
      const snapshot = await getXlmPrice('USD', { fetchImpl });
      expect(snapshot?.price).toBe(0.12);
      expect(fetchImpl).not.toHaveBeenCalled();
    });

    it('refreshes when the cached snapshot has exceeded the TTL', async () => {
      asyncStorageStore[priceCacheKey('USD')] = JSON.stringify({
        price: 0.10,
        fetchedAt: Date.now() - PRICE_CACHE_TTL_MS - 1,
      });
      const fetchImpl = jest.fn().mockResolvedValue(jsonOk({ stellar: { usd: 0.20 } }));
      const snapshot = await getXlmPrice('USD', { fetchImpl });
      expect(snapshot?.price).toBe(0.20);
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    });

    it('falls back to the stale cached snapshot when a refresh attempt fails', async () => {
      asyncStorageStore[priceCacheKey('USD')] = JSON.stringify({
        price: 0.10,
        fetchedAt: Date.now() - PRICE_CACHE_TTL_MS - 1,
      });
      const fetchImpl = jest.fn().mockRejectedValue(new Error('offline'));
      const snapshot = await getXlmPrice('USD', { fetchImpl });
      expect(snapshot?.price).toBe(0.10);
    });

    it('returns null when there is nothing cached and the fetch fails (graceful degradation)', async () => {
      const fetchImpl = jest.fn().mockRejectedValue(new Error('offline'));
      expect(await getXlmPrice('USD', { fetchImpl })).toBeNull();
    });

    it('returns null on first launch when offline, without throwing', async () => {
      mockNetInfo.fetch.mockResolvedValue({ isConnected: false, isInternetReachable: false });
      const fetchImpl = jest.fn();
      await expect(getXlmPrice('USD', { fetchImpl })).resolves.toBeNull();
    });
  });
});
