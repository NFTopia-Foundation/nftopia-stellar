import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Max number of entries retained; oldest entries are evicted first. */
export const MAX_RECENTLY_VIEWED = 20;

export interface RecentlyViewedEntry {
  nftId: string;
  viewedAt: number;
}

interface RecentlyViewedStore {
  items: RecentlyViewedEntry[];
  /** Records (or re-records) a view, moving the NFT to the front of the list. */
  trackView: (nftId: string) => void;
  clearHistory: () => void;
}

/**
 * Tracks NFT ids the user has opened on the detail page, most-recent first.
 * Mirrors nftopia-mobile-app/stores/recentlyViewedStore.ts (kept in sync by
 * hand - the two apps don't share a package).
 */
export const useRecentlyViewedStore = create<RecentlyViewedStore>()(
  persist(
    (set) => ({
      items: [],

      trackView: (nftId) =>
        set((state) => ({
          // Drop any existing entry for this NFT so re-viewing moves it to
          // the front instead of creating a duplicate, then cap the length.
          items: [
            { nftId, viewedAt: Date.now() },
            ...state.items.filter((item) => item.nftId !== nftId),
          ].slice(0, MAX_RECENTLY_VIEWED),
        })),

      clearHistory: () => set({ items: [] }),
    }),
    {
      name: "nftopia-recently-viewed",
      partialize: (state) => ({ items: state.items }),
    },
  ),
);
