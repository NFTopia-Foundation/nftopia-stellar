const mockApiCalls: string[] = [];
const mockMintNft = jest.fn(async (payload: unknown) => {
  mockApiCalls.push(`mint:${(payload as { id: string }).id}`);
});
const mockCreateCollection = jest.fn(async (payload: unknown) => {
  mockApiCalls.push(`collection:${(payload as { id: string }).id}`);
});
const mockMarkNotificationRead = jest.fn(async (_id: string) => {});
const mockTrackEvent = jest.fn(async (_event: string, _properties: unknown) => {});

jest.mock('@/lib/api/sample', () => ({
  __esModule: true,
  default: {
    mintNFT: mockMintNft,
    createCollection: mockCreateCollection,
    markNotificationRead: mockMarkNotificationRead,
    trackEvent: mockTrackEvent,
  },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { OfflineQueueItem } from '@/types';
import { useOfflineStore } from '../offlineStore';

const flushPersistence = () => new Promise((resolve) => setTimeout(resolve, 0));

const emptyCachedData = {
  nfts: [],
  collections: [],
  notifications: [],
  favorites: [],
  watchlist: [],
  recentSearches: [],
  lastSync: '',
};

function queueMint(id: string) {
  useOfflineStore.getState().addToQueue({
    action: 'mint_nft',
    payload: { id },
  });
}

describe('useOfflineStore', () => {
  beforeEach(async () => {
    mockApiCalls.length = 0;
    mockMintNft.mockReset().mockImplementation(async (payload: unknown) => {
      mockApiCalls.push(`mint:${(payload as { id: string }).id}`);
    });
    mockCreateCollection.mockReset().mockImplementation(async (payload: unknown) => {
      mockApiCalls.push(`collection:${(payload as { id: string }).id}`);
    });
    mockMarkNotificationRead.mockReset();
    mockTrackEvent.mockReset();
    await AsyncStorage.removeItem('offline-storage');
    useOfflineStore.setState({
      isOnline: true,
      queue: [],
      cachedData: emptyCachedData,
      lastSync: null,
      writeActionsBlocked: false,
    });
    await flushPersistence();
    await AsyncStorage.removeItem('offline-storage');
  });

  it('queues writes while offline without sending them', () => {
    useOfflineStore.getState().setOnlineStatus(false);
    queueMint('offline-1');

    expect(useOfflineStore.getState().queue).toHaveLength(1);
    expect(useOfflineStore.getState().queue[0].payload).toEqual({ id: 'offline-1' });
    expect(useOfflineStore.getState().canPerformWriteAction()).toBe(false);
    expect(mockMintNft).not.toHaveBeenCalled();
  });

  it('replays queued writes in insertion order when connectivity returns', async () => {
    useOfflineStore.getState().setOnlineStatus(false);
    queueMint('first');
    useOfflineStore.getState().addToQueue({
      action: 'create_collection',
      payload: { id: 'second' },
    });

    const reconnecting = useOfflineStore.getState().setOnlineStatus(true);
    const explicitReplay = useOfflineStore.getState().processQueue();
    await Promise.all([reconnecting, explicitReplay]);

    expect(mockApiCalls).toEqual(['mint:first', 'collection:second']);
    expect(useOfflineStore.getState().queue).toEqual([]);
  });

  it('retains a conflicting write for retry while continuing later writes', async () => {
    useOfflineStore.getState().setOnlineStatus(false);
    queueMint('conflict');
    useOfflineStore.getState().addToQueue({
      action: 'create_collection',
      payload: { id: 'later' },
    });
    mockMintNft.mockRejectedValueOnce(new Error('Conflict'));

    useOfflineStore.getState().setOnlineStatus(true);
    await useOfflineStore.getState().processQueue();

    expect(mockApiCalls).toEqual(['collection:later']);
    expect(useOfflineStore.getState().queue).toHaveLength(1);
    expect(useOfflineStore.getState().queue[0]).toMatchObject({
      action: 'mint_nft',
      payload: { id: 'conflict' },
      retryCount: 1,
    });

    await useOfflineStore.getState().processQueue();
    expect(mockApiCalls).toEqual(['collection:later', 'mint:conflict']);
    expect(useOfflineStore.getState().queue).toEqual([]);
  });

  it('reports queued writes as available only when online and unblocked', () => {
    expect(useOfflineStore.getState().canPerformWriteAction()).toBe(true);
    useOfflineStore.getState().setOnlineStatus(false);
    expect(useOfflineStore.getState().canPerformWriteAction()).toBe(false);
    useOfflineStore.getState().setOnlineStatus(true);
    expect(useOfflineStore.getState().canPerformWriteAction()).toBe(true);
    useOfflineStore.getState().blockWriteActions(true);
    expect(useOfflineStore.getState().canPerformWriteAction()).toBe(false);
  });

  it('rehydrates cached data and queued writes from AsyncStorage', async () => {
    const persistedQueue: OfflineQueueItem[] = [
      {
        id: 'persisted-1',
        action: 'mint_nft',
        payload: { id: 'restored' },
        timestamp: '2026-01-01T00:00:00.000Z',
        retryCount: 1,
        maxRetries: 3,
      },
    ];
    const cachedData = {
      ...emptyCachedData,
      favorites: ['nft-restored'],
    };
    await AsyncStorage.setItem(
      'offline-storage',
      JSON.stringify({
        state: { queue: persistedQueue, cachedData, lastSync: '2026-01-01T00:00:00.000Z' },
        version: 0,
      }),
    );

    await useOfflineStore.persist.rehydrate();

    expect(useOfflineStore.getState().queue).toEqual(persistedQueue);
    expect(useOfflineStore.getState().cachedData.favorites).toEqual(['nft-restored']);
    expect(useOfflineStore.getState().lastSync).toBe('2026-01-01T00:00:00.000Z');
  });
});