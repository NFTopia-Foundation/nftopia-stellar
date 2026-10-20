// ── Mocks ─────────────────────────────────────────────────────────────────────

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

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
  mergeItem: jest.fn(),
  clear: jest.fn(() => {
    Object.keys(asyncStorageStore).forEach((k) => delete asyncStorageStore[k]);
    return Promise.resolve();
  }),
  getAllKeys: jest.fn(() => Promise.resolve(Object.keys(asyncStorageStore))),
  multiGet: jest.fn(),
  multiSet: jest.fn(),
  multiRemove: jest.fn(),
}));

// Mock the apiClient so tests never hit the network
jest.mock('@/lib/api/sample', () => ({
  __esModule: true,
  default: {
    followUser: jest.fn(),
    unfollowUser: jest.fn(),
    getFollowCounts: jest.fn(),
    getMutualFollows: jest.fn(),
    getUserSocialActivity: jest.fn(),
  },
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import apiClient from '@/lib/api/sample';
import { useSocialStore } from '../socialStore';
import { CreatorProfile, ActivityEvent } from '@/types';

const mockedApiClient = apiClient as jest.Mocked<typeof apiClient>;

function getStore() {
  return useSocialStore.getState();
}

const PROFILE_STUB: CreatorProfile = {
  id: 'user-1',
  username: 'creator1',
  displayName: 'Creator One',
  avatarUrl: 'https://example.com/avatar.jpg',
  isVerified: false,
  isFollowing: false,
  followerCount: 10,
  followingCount: 5,
  nftCount: 3,
  collectionCount: 1,
  totalVolume: '100',
  walletAddress: 'GXXX',
  createdAt: '2024-01-01T00:00:00Z',
};

const ACTIVITY_STUB: ActivityEvent[] = [
  {
    id: 'evt-1',
    type: 'mint',
    nftId: 'nft-1',
    nftName: 'NFT One',
    nftImage: 'https://example.com/nft.jpg',
    timestamp: '2024-01-01T00:00:00Z',
  },
];

describe('useSocialStore', () => {
  beforeEach(() => {
    useSocialStore.setState({
      followingMap: {},
      countsMap: {},
      mutualFollowersMap: {},
      activityMap: {},
      isLoading: false,
      error: null,
    });
    jest.clearAllMocks();
  });

  // ── isFollowing / setFollowState ─────────────────────────────────────────────

  describe('isFollowing selector', () => {
    it('returns false for unknown user', () => {
      expect(getStore().isFollowing('unknown')).toBe(false);
    });

    it('returns the seeded value after setFollowState', () => {
      getStore().setFollowState('user-1', true);
      expect(getStore().isFollowing('user-1')).toBe(true);
    });

    it('setFollowState false clears following', () => {
      getStore().setFollowState('user-1', true);
      getStore().setFollowState('user-1', false);
      expect(getStore().isFollowing('user-1')).toBe(false);
    });
  });

  // ── followUser ───────────────────────────────────────────────────────────────

  describe('followUser', () => {
    it('calls apiClient.followUser and sets followingMap to true', async () => {
      mockedApiClient.followUser.mockResolvedValueOnce(undefined);

      await getStore().followUser('user-1');

      expect(mockedApiClient.followUser).toHaveBeenCalledWith('user-1');
      expect(getStore().isFollowing('user-1')).toBe(true);
    });

    it('increments follower count by 1', async () => {
      useSocialStore.setState({
        countsMap: { 'user-1': { followers: 5, following: 2 } },
      });
      mockedApiClient.followUser.mockResolvedValueOnce(undefined);

      await getStore().followUser('user-1');

      expect(getStore().getFollowCounts('user-1').followers).toBe(6);
    });

    it('sets isLoading false and stores error on failure', async () => {
      mockedApiClient.followUser.mockRejectedValueOnce(new Error('network error'));

      await expect(getStore().followUser('user-1')).rejects.toThrow('network error');
      expect(getStore().isLoading).toBe(false);
      expect(getStore().error).toBe('network error');
    });
  });

  // ── unfollowUser ─────────────────────────────────────────────────────────────

  describe('unfollowUser', () => {
    it('calls apiClient.unfollowUser and sets followingMap to false', async () => {
      useSocialStore.setState({ followingMap: { 'user-1': true } });
      mockedApiClient.unfollowUser.mockResolvedValueOnce(undefined);

      await getStore().unfollowUser('user-1');

      expect(mockedApiClient.unfollowUser).toHaveBeenCalledWith('user-1');
      expect(getStore().isFollowing('user-1')).toBe(false);
    });

    it('decrements follower count by 1 and does not go below 0', async () => {
      useSocialStore.setState({
        followingMap: { 'user-1': true },
        countsMap: { 'user-1': { followers: 1, following: 0 } },
      });
      mockedApiClient.unfollowUser.mockResolvedValueOnce(undefined);

      await getStore().unfollowUser('user-1');

      expect(getStore().getFollowCounts('user-1').followers).toBe(0);

      // Unfollow again: floor at 0
      useSocialStore.setState({ countsMap: { 'user-1': { followers: 0, following: 0 } } });
      mockedApiClient.unfollowUser.mockResolvedValueOnce(undefined);
      await getStore().unfollowUser('user-1');
      expect(getStore().getFollowCounts('user-1').followers).toBe(0);
    });

    it('stores error on failure', async () => {
      mockedApiClient.unfollowUser.mockRejectedValueOnce(new Error('unfollow failed'));

      await expect(getStore().unfollowUser('user-1')).rejects.toThrow('unfollow failed');
      expect(getStore().error).toBe('unfollow failed');
    });
  });

  // ── toggleFollow ─────────────────────────────────────────────────────────────

  describe('toggleFollow', () => {
    it('follows when not currently following', async () => {
      mockedApiClient.followUser.mockResolvedValueOnce(undefined);
      useSocialStore.setState({ followingMap: { 'user-1': false } });

      await getStore().toggleFollow('user-1');

      expect(mockedApiClient.followUser).toHaveBeenCalledWith('user-1');
      expect(getStore().isFollowing('user-1')).toBe(true);
    });

    it('unfollows when currently following', async () => {
      mockedApiClient.unfollowUser.mockResolvedValueOnce(undefined);
      useSocialStore.setState({ followingMap: { 'user-1': true } });

      await getStore().toggleFollow('user-1');

      expect(mockedApiClient.unfollowUser).toHaveBeenCalledWith('user-1');
      expect(getStore().isFollowing('user-1')).toBe(false);
    });
  });

  // ── fetchFollowCounts ─────────────────────────────────────────────────────────

  describe('fetchFollowCounts', () => {
    it('populates countsMap from API response', async () => {
      mockedApiClient.getFollowCounts.mockResolvedValueOnce({ followers: 42, following: 7 });

      await getStore().fetchFollowCounts('user-1');

      expect(getStore().getFollowCounts('user-1')).toEqual({ followers: 42, following: 7 });
    });

    it('stores error message on failure', async () => {
      mockedApiClient.getFollowCounts.mockRejectedValueOnce(new Error('counts failed'));

      await getStore().fetchFollowCounts('user-1');

      expect(getStore().error).toBe('counts failed');
    });

    it('returns default counts for unknown user', () => {
      expect(getStore().getFollowCounts('nobody')).toEqual({ followers: 0, following: 0 });
    });
  });

  // ── fetchMutualFollowers ──────────────────────────────────────────────────────

  describe('fetchMutualFollowers', () => {
    it('populates mutualFollowersMap from API response', async () => {
      mockedApiClient.getMutualFollows.mockResolvedValueOnce([PROFILE_STUB]);

      await getStore().fetchMutualFollowers('user-1');

      expect(getStore().getMutualFollowers('user-1')).toEqual([PROFILE_STUB]);
    });

    it('returns empty array for unknown user', () => {
      expect(getStore().getMutualFollowers('nobody')).toEqual([]);
    });

    it('stores error on failure', async () => {
      mockedApiClient.getMutualFollows.mockRejectedValueOnce(new Error('mutual failed'));

      await getStore().fetchMutualFollowers('user-1');

      expect(getStore().error).toBe('mutual failed');
    });
  });

  // ── fetchUserSocialActivity ───────────────────────────────────────────────────

  describe('fetchUserSocialActivity', () => {
    it('populates activityMap from API response', async () => {
      mockedApiClient.getUserSocialActivity.mockResolvedValueOnce(ACTIVITY_STUB);

      await getStore().fetchUserSocialActivity('user-1');

      expect(getStore().getUserActivity('user-1')).toEqual(ACTIVITY_STUB);
    });

    it('returns empty array for unknown user', () => {
      expect(getStore().getUserActivity('nobody')).toEqual([]);
    });

    it('stores error on failure', async () => {
      mockedApiClient.getUserSocialActivity.mockRejectedValueOnce(new Error('activity failed'));

      await getStore().fetchUserSocialActivity('user-1');

      expect(getStore().error).toBe('activity failed');
    });

    it('passes page and limit to apiClient', async () => {
      mockedApiClient.getUserSocialActivity.mockResolvedValueOnce([]);

      await getStore().fetchUserSocialActivity('user-1', 2, 10);

      expect(mockedApiClient.getUserSocialActivity).toHaveBeenCalledWith('user-1', 2, 10);
    });
  });

  // ── clearError ───────────────────────────────────────────────────────────────

  describe('clearError', () => {
    it('resets the error field to null', async () => {
      useSocialStore.setState({ error: 'some error' });
      getStore().clearError();
      expect(getStore().error).toBeNull();
    });
  });
});
