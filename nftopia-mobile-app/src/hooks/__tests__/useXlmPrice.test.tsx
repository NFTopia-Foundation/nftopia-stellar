import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import { useXlmPrice, type UseXlmPriceResult } from '@/src/hooks/useXlmPrice';
import { usePreferencesStore } from '@/stores/preferencesStore';

jest.mock('@/src/services/stellar/priceService', () => ({
  getCachedXlmPrice: jest.fn(),
  refreshXlmPrice: jest.fn(),
}));

import { getCachedXlmPrice, refreshXlmPrice } from '@/src/services/stellar/priceService';

const mockGetCached = getCachedXlmPrice as jest.Mock;
const mockRefresh = refreshXlmPrice as jest.Mock;

function Harness({ onResult }: { onResult: (result: UseXlmPriceResult) => void }) {
  const result = useXlmPrice();
  onResult(result);
  return <Text>{JSON.stringify(result)}</Text>;
}

async function renderHarness() {
  const results: UseXlmPriceResult[] = [];
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(
      <Harness onResult={(r) => results.push(r)} /> as never,
    );
    // Flush the microtask queue so the effect's cache-read promise settles.
    await Promise.resolve();
    await Promise.resolve();
  });
  return { renderer, results: () => results };
}

describe('useXlmPrice (#470)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    usePreferencesStore.setState({ currency: 'USD' });
  });

  it('starts loading, then resolves with the cached price when the cache is fresh (no refresh call)', async () => {
    mockGetCached.mockResolvedValue({ currency: 'USD', price: 0.12, fetchedAt: Date.now() });

    const { results } = await renderHarness();
    const last = results()[results().length - 1];

    expect(last.loading).toBe(false);
    expect(last.price).toBe(0.12);
    expect(last.currency).toBe('USD');
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it('refreshes in the background when the cached snapshot is past its TTL, updating the price once it resolves', async () => {
    const staleTtl = Date.now() - 10 * 60 * 1000; // well past the 1-minute refresh TTL
    mockGetCached.mockResolvedValue({ currency: 'USD', price: 0.10, fetchedAt: staleTtl });
    mockRefresh.mockResolvedValue({ currency: 'USD', price: 0.20, fetchedAt: Date.now() });

    const { results } = await renderHarness();
    const last = results()[results().length - 1];

    expect(mockRefresh).toHaveBeenCalledWith('USD');
    expect(last.price).toBe(0.20);
    expect(last.loading).toBe(false);
  });

  it('reports stale: true when the cached snapshot has aged past the staleness threshold', async () => {
    const veryOld = Date.now() - 60 * 60 * 1000; // 1 hour — past the 5-minute stale threshold
    mockGetCached.mockResolvedValue({ currency: 'USD', price: 0.10, fetchedAt: veryOld });
    mockRefresh.mockResolvedValue(null); // refresh fails, keep the stale cached value

    const { results } = await renderHarness();
    const last = results()[results().length - 1];

    expect(last.price).toBe(0.10);
    expect(last.stale).toBe(true);
  });

  it('reports price: null and stale: false when there is no cached price and no successful refresh', async () => {
    mockGetCached.mockResolvedValue(null);
    mockRefresh.mockResolvedValue(null);

    const { results } = await renderHarness();
    const last = results()[results().length - 1];

    expect(last.price).toBeNull();
    expect(last.stale).toBe(false);
    expect(last.loading).toBe(false);
  });

  it('re-fetches for the new currency when the preferences store currency changes', async () => {
    mockGetCached.mockImplementation((currency: string) =>
      Promise.resolve(
        currency === 'USD'
          ? { currency: 'USD', price: 0.12, fetchedAt: Date.now() }
          : { currency: 'EUR', price: 0.11, fetchedAt: Date.now() },
      ),
    );

    const { results } = await renderHarness();
    expect(results()[results().length - 1].currency).toBe('USD');

    await act(async () => {
      usePreferencesStore.setState({ currency: 'EUR' });
      await Promise.resolve();
      await Promise.resolve();
    });

    const last = results()[results().length - 1];
    expect(last.currency).toBe('EUR');
    expect(last.price).toBe(0.11);
    expect(mockGetCached).toHaveBeenCalledWith('EUR');
  });
});
