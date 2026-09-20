import {
  __getCachedQuote,
  clearPriceCache,
  convertBalanceToFiat,
  fetchAssetRates,
  getAssetPrice,
  getXlmPrice,
  isQuoteStale,
  refreshAssetPrice,
} from '../priceService';

const okResponse = (body: unknown) => ({
  ok: true,
  json: () => Promise.resolve(body),
});

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('priceService', () => {
  beforeEach(() => clearPriceCache());

  describe('fetchAssetRates', () => {
    it('fetches and normalizes rates for several assets and currencies', async () => {
      const fetchImpl = jest.fn().mockResolvedValue(
        okResponse({
          stellar: { usd: 0.42, eur: 0.39 },
          'usd-coin': { usd: 1.0 },
        })
      ) as unknown as typeof fetch;

      const rates = await fetchAssetRates(['xlm', 'USDC'], ['usd', 'EUR'], { fetchImpl });
      expect(rates).toEqual({
        XLM: { USD: 0.42, EUR: 0.39 },
        USDC: { USD: 1.0 },
      });
      const calledUrl = decodeURIComponent((fetchImpl as jest.Mock).mock.calls[0][0] as string);
      expect(calledUrl).toContain('ids=stellar,usd-coin');
      expect(calledUrl).toContain('vs_currencies=usd,eur');
    });

    it('returns null on a non-ok response', async () => {
      const fetchImpl = jest.fn().mockResolvedValue({ ok: false }) as unknown as typeof fetch;
      await expect(fetchAssetRates(['XLM'], ['USD'], { fetchImpl })).resolves.toBeNull();
    });

    it('returns null when the network throws', async () => {
      const fetchImpl = jest.fn().mockRejectedValue(new Error('offline')) as unknown as typeof fetch;
      await expect(fetchAssetRates(['XLM'], ['USD'], { fetchImpl })).resolves.toBeNull();
    });

    it('ignores unknown assets without calling the network', async () => {
      const fetchImpl = jest.fn() as unknown as typeof fetch;
      await expect(fetchAssetRates(['DOGE'], ['USD'], { fetchImpl })).resolves.toBeNull();
      expect(fetchImpl).not.toHaveBeenCalled();
    });

    it('drops non-numeric or negative rate values', async () => {
      const fetchImpl = jest.fn().mockResolvedValue(
        okResponse({ stellar: { usd: 'nope', eur: -1, gbp: 0.3 } })
      ) as unknown as typeof fetch;
      const rates = await fetchAssetRates(['XLM'], ['USD', 'EUR', 'GBP'], { fetchImpl });
      expect(rates).toEqual({ XLM: { GBP: 0.3 } });
    });
  });

  describe('getAssetPrice', () => {
    it('fetches once and serves the cached quote within the TTL', async () => {
      const fetchImpl = jest.fn().mockResolvedValue(okResponse({ stellar: { usd: 0.5 } }));
      const now = jest.fn().mockReturnValue(1_000);

      const first = await getAssetPrice('XLM', 'USD', { fetchImpl: fetchImpl as never, now });
      expect(first?.rate).toBe(0.5);
      expect(first?.isStale).toBe(false);

      const second = await getAssetPrice('XLM', 'USD', { fetchImpl: fetchImpl as never, now });
      expect(second?.rate).toBe(0.5);
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    });

    it('returns stale cached data immediately and refreshes in the background', async () => {
      const fetchImpl = jest
        .fn()
        .mockResolvedValueOnce(okResponse({ stellar: { usd: 0.5 } }))
        .mockResolvedValueOnce(okResponse({ stellar: { usd: 0.9 } }));

      const baseConfig = { fetchImpl: fetchImpl as never, now: () => 1_000 };
      await getAssetPrice('XLM', 'USD', baseConfig);

      // 10 minutes later → past the 5 minute staleness threshold.
      const stale = await getAssetPrice('XLM', 'USD', {
        ...baseConfig,
        now: () => 1_000 + 10 * 60_000,
      });
      expect(stale?.rate).toBe(0.5);
      expect(stale?.isStale).toBe(true);

      await flush();
      expect(fetchImpl).toHaveBeenCalledTimes(2);
      expect(__getCachedQuote('XLM', 'USD')?.rate).toBe(0.9);
    });

    it('returns null when the network fails and nothing is cached', async () => {
      const fetchImpl = jest.fn().mockRejectedValue(new Error('offline')) as unknown as typeof fetch;
      await expect(getAssetPrice('XLM', 'USD', { fetchImpl })).resolves.toBeNull();
    });

    it('returns null for an asset it cannot price', async () => {
      const fetchImpl = jest.fn() as unknown as typeof fetch;
      await expect(getAssetPrice('DOGE', 'USD', { fetchImpl })).resolves.toBeNull();
    });

    it('getXlmPrice defaults to USD', async () => {
      const fetchImpl = jest.fn().mockResolvedValue(okResponse({ stellar: { usd: 0.25 } }));
      const quote = await getXlmPrice(undefined, { fetchImpl: fetchImpl as never });
      expect(quote?.currency).toBe('USD');
      expect(quote?.rate).toBe(0.25);
    });
  });

  describe('refreshAssetPrice', () => {
    it('de-duplicates concurrent requests', async () => {
      const fetchImpl = jest.fn().mockResolvedValue(okResponse({ stellar: { usd: 0.5 } }));
      await Promise.all([
        refreshAssetPrice('XLM', 'USD', { fetchImpl: fetchImpl as never }),
        refreshAssetPrice('XLM', 'USD', { fetchImpl: fetchImpl as never }),
      ]);
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    });
  });

  describe('convertBalanceToFiat', () => {
    it('converts a balance using the quote rate', () => {
      expect(
        convertBalanceToFiat('10', {
          assetCode: 'XLM',
          currency: 'USD',
          rate: 0.4,
          fetchedAt: 0,
          source: 'test',
          isStale: false,
        })
      ).toBeCloseTo(4);
    });

    it('returns null without a quote', () => {
      expect(convertBalanceToFiat('10', null)).toBeNull();
    });
  });

  describe('isQuoteStale', () => {
    it('flags quotes past the threshold', () => {
      expect(isQuoteStale(0, 60_000, 5 * 60_000)).toBe(false);
      expect(isQuoteStale(0, 10 * 60_000, 5 * 60_000)).toBe(true);
    });
  });
});
