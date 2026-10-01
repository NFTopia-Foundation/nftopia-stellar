import {
  PRICE_CACHE_TTL_MS,
  PRICE_STALE_THRESHOLD_MS,
  convertToFiat,
  isPriceStale,
  priceCacheKey,
  shouldRefreshPrice,
} from '../price';

describe('priceCacheKey', () => {
  it('namespaces the key by lowercased currency code', () => {
    expect(priceCacheKey('USD')).toBe('@nftopia/price_service/xlm_price/usd');
    expect(priceCacheKey('eur')).toBe('@nftopia/price_service/xlm_price/eur');
  });
});

describe('isPriceStale', () => {
  it('is false for a snapshot fetched just now', () => {
    expect(isPriceStale({ fetchedAt: 1000 }, 1000)).toBe(false);
  });

  it('is false right at the threshold boundary', () => {
    expect(isPriceStale({ fetchedAt: 0 }, PRICE_STALE_THRESHOLD_MS)).toBe(false);
  });

  it('is true just past the threshold', () => {
    expect(isPriceStale({ fetchedAt: 0 }, PRICE_STALE_THRESHOLD_MS + 1)).toBe(true);
  });

  it('honors a custom threshold', () => {
    expect(isPriceStale({ fetchedAt: 0 }, 100, 50)).toBe(true);
    expect(isPriceStale({ fetchedAt: 0 }, 50, 100)).toBe(false);
  });
});

describe('shouldRefreshPrice', () => {
  it('is true when there is no snapshot at all', () => {
    expect(shouldRefreshPrice(null)).toBe(true);
  });

  it('is false for a snapshot within the TTL', () => {
    expect(shouldRefreshPrice({ fetchedAt: 1000 }, 1000)).toBe(false);
  });

  it('is false right at the TTL boundary', () => {
    expect(shouldRefreshPrice({ fetchedAt: 0 }, PRICE_CACHE_TTL_MS)).toBe(false);
  });

  it('is true once the TTL has elapsed', () => {
    expect(shouldRefreshPrice({ fetchedAt: 0 }, PRICE_CACHE_TTL_MS + 1)).toBe(true);
  });

  it('honors a custom TTL', () => {
    expect(shouldRefreshPrice({ fetchedAt: 0 }, 100, 50)).toBe(true);
    expect(shouldRefreshPrice({ fetchedAt: 0 }, 50, 100)).toBe(false);
  });
});

describe('convertToFiat', () => {
  it('multiplies a numeric amount by the price per unit', () => {
    expect(convertToFiat(10, 0.12)).toBeCloseTo(1.2);
  });

  it('accepts a string amount (as balances are represented)', () => {
    expect(convertToFiat('10.5', 0.12)).toBeCloseTo(1.26);
  });

  it('returns 0 for a zero amount', () => {
    expect(convertToFiat(0, 0.12)).toBe(0);
    expect(convertToFiat('0', 0.12)).toBe(0);
  });

  it('returns 0 for a zero price (e.g. an unpriced asset)', () => {
    expect(convertToFiat(100, 0)).toBe(0);
  });

  it('handles a negative amount without special-casing it away', () => {
    expect(convertToFiat(-5, 0.12)).toBeCloseTo(-0.6);
  });

  it('handles a negative price without throwing (defensive — should never occur in practice)', () => {
    expect(convertToFiat(10, -0.12)).toBeCloseTo(-1.2);
  });

  it('returns 0 for a non-numeric string amount rather than NaN', () => {
    expect(convertToFiat('not-a-number', 0.12)).toBe(0);
  });

  it('returns 0 when the price itself is non-finite', () => {
    expect(convertToFiat(10, NaN)).toBe(0);
    expect(convertToFiat(10, Infinity)).toBe(0);
  });

  it('returns 0 for an empty string amount', () => {
    expect(convertToFiat('', 0.12)).toBe(0);
  });
});
