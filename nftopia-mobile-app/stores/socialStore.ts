import { createStore } from '@/src/utils/store.factory';
import apiClient from '@/lib/api/sample';
import { CreatorProfile, ActivityEvent } from '@/types';

// ============================================================
// Types
// ============================================================

export interface SocialCounts {
  followers: number;
  following: number;
}

export interface SocialState {
  /** Map of userId → whether the current user follows that creator */
  followingMap: Record<string, boolean>;
  /** Map of userId → { followers, following } counts */
  countsMap: Record<string, SocialCounts>;
  /** Map of userId → mutual-follower profiles */
  mutualFollowersMap: Record<string, CreatorProfile[]>;
  /** Map of userId → social activity feed */
  activityMap: Record<string, ActivityEvent[]>;
  isLoading: boolean;
  error: string | null;

  // Actions
  followUser: (userId: string) => Promise<void>;
  unfollowUser: (userId: string) => Promise<void>;
  toggleFollow: (userId: string) => Promise<void>;
  fetchFollowCounts: (userId: string) => Promise<void>;
  fetchMutualFollowers: (userId: string) => Promise<void>;
  fetchUserSocialActivity: (userId: string, page?: number, limit?: number) => Promise<void>;
  isFollowing: (userId: string) => boolean;
  getFollowCounts: (userId: string) => SocialCounts;
  getMutualFollowers: (userId: string) => CreatorProfile[];
  getUserActivity: (userId: string) => ActivityEvent[];
  setFollowState: (userId: string, following: boolean) => void;
  clearError: () => void;
}

// ============================================================
// Defaults
// ============================================================

const DEFAULT_COUNTS: SocialCounts = { followers: 0, following: 0 };

// ============================================================
// Store
// ============================================================

export const useSocialStore = createStore<SocialState>({
  name: 'social-store',
  initialState: {
    followingMap: {},
    countsMap: {},
    mutualFollowersMap: {},
    activityMap: {},
    isLoading: false,
    error: null,

    followUser: async () => {},
    unfollowUser: async () => {},
    toggleFollow: async () => {},
    fetchFollowCounts: async () => {},
    fetchMutualFollowers: async () => {},
    fetchUserSocialActivity: async () => {},
    isFollowing: () => false,
    getFollowCounts: () => DEFAULT_COUNTS,
    getMutualFollowers: () => [],
    getUserActivity: () => [],
    setFollowState: () => {},
    clearError: () => {},
  },
  actions: (set, get) => ({
    // ── State defaults ──────────────────────────────────────
    followingMap: {},
    countsMap: {},
    mutualFollowersMap: {},
    activityMap: {},
    isLoading: false,
    error: null,

    // ── Follow / Unfollow ───────────────────────────────────

    followUser: async (userId: string) => {
      set({ isLoading: true, error: null });
      try {
        await apiClient.followUser(userId);
        set((state) => ({
          followingMap: { ...state.followingMap, [userId]: true },
          countsMap: {
            ...state.countsMap,
            [userId]: {
              followers: (state.countsMap[userId]?.followers ?? 0) + 1,
              following: state.countsMap[userId]?.following ?? 0,
            },
          },
          isLoading: false,
        }));
      } catch (err) {
        set({
          isLoading: false,
          error: err instanceof Error ? err.message : 'Failed to follow user',
        });
        throw err;
      }
    },

    unfollowUser: async (userId: string) => {
      set({ isLoading: true, error: null });
      try {
        await apiClient.unfollowUser(userId);
        set((state) => ({
          followingMap: { ...state.followingMap, [userId]: false },
          countsMap: {
            ...state.countsMap,
            [userId]: {
              followers: Math.max(0, (state.countsMap[userId]?.followers ?? 1) - 1),
              following: state.countsMap[userId]?.following ?? 0,
            },
          },
          isLoading: false,
        }));
      } catch (err) {
        set({
          isLoading: false,
          error: err instanceof Error ? err.message : 'Failed to unfollow user',
        });
        throw err;
      }
    },

    toggleFollow: async (userId: string) => {
      const currently = get().isFollowing(userId);
      if (currently) {
        await get().unfollowUser(userId);
      } else {
        await get().followUser(userId);
      }
    },

    // ── Counts ──────────────────────────────────────────────

    fetchFollowCounts: async (userId: string) => {
      try {
        const counts = await apiClient.getFollowCounts(userId);
        set((state) => ({
          countsMap: { ...state.countsMap, [userId]: counts },
        }));
      } catch (err) {
        set({
          error: err instanceof Error ? err.message : 'Failed to fetch follow counts',
        });
      }
    },

    // ── Mutual Followers ────────────────────────────────────

    fetchMutualFollowers: async (userId: string) => {
      try {
        const mutual = await apiClient.getMutualFollows(userId);
        set((state) => ({
          mutualFollowersMap: { ...state.mutualFollowersMap, [userId]: mutual },
        }));
      } catch (err) {
        set({
          error: err instanceof Error ? err.message : 'Failed to fetch mutual followers',
        });
      }
    },

    // ── Social Activity Feed ────────────────────────────────

    fetchUserSocialActivity: async (
      userId: string,
      page: number = 1,
      limit: number = 20,
    ) => {
      try {
        const activity = await apiClient.getUserSocialActivity(userId, page, limit);
        set((state) => ({
          activityMap: { ...state.activityMap, [userId]: activity },
        }));
      } catch (err) {
        set({
          error: err instanceof Error ? err.message : 'Failed to fetch social activity',
        });
      }
    },

    // ── Selectors ───────────────────────────────────────────

    isFollowing: (userId: string) => {
      return get().followingMap[userId] ?? false;
    },

    getFollowCounts: (userId: string) => {
      return get().countsMap[userId] ?? DEFAULT_COUNTS;
    },

    getMutualFollowers: (userId: string) => {
      return get().mutualFollowersMap[userId] ?? [];
    },

    getUserActivity: (userId: string) => {
      return get().activityMap[userId] ?? [];
    },

    // ── Helpers ─────────────────────────────────────────────

    /** Seed follow state from profile data (e.g. after loading the creator profile). */
    setFollowState: (userId: string, following: boolean) => {
      set((state) => ({
        followingMap: { ...state.followingMap, [userId]: following },
      }));
    },

    clearError: () => {
      set({ error: null });
    },
  }),
  devtools: {
    enabled: __DEV__,
    name: 'SocialStore',
  },
});
