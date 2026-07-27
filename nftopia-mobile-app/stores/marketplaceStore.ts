import { create } from "zustand";
import {
  fetchMarketplaceListings,
  type FetchListingsResult,
} from "@/src/services/marketplace/marketplace.service";
import type {
  MarketplaceFilter,
  MarketplaceState,
} from "@/types/index";
import { DEFAULT_FILTER } from "@/types/index";

interface MarketplaceActions {
  /** Fetch the first page of listings */
  fetchListings: (filter?: Partial<MarketplaceFilter>) => Promise<void>;
  /** Fetch the next page (infinite scroll) */
  fetchNextPage: () => Promise<void>;
  /** Pull-to-refresh */
  refreshListings: () => Promise<void>;
  /** Update filter and reload */
  updateFilter: (filter: Partial<MarketplaceFilter>) => void;
  /** Set search text */
  setSearch: (search: string) => void;
  /** Clear all filters */
  clearFilters: () => void;
}

export type MarketplaceStore = MarketplaceState & MarketplaceActions;

const initialState: MarketplaceState = {
  listings: [],
  pageInfo: {
    hasNextPage: false,
    startCursor: null,
    endCursor: null,
  },
  totalCount: 0,
  isLoading: false,
  isLoadingMore: false,
  isRefreshing: false,
  error: null,
  filter: { ...DEFAULT_FILTER },
};

export const useMarketplaceStore = create<MarketplaceStore>()((set, get) => ({
  ...initialState,

  fetchListings: async (filterOverride?: Partial<MarketplaceFilter>) => {
    const { filter: currentFilter } = get();
    const appliedFilter = filterOverride
      ? { ...currentFilter, ...filterOverride }
      : currentFilter;

    set({
      isLoading: true,
      error: null,
      filter: appliedFilter,
      pageInfo: { hasNextPage: false, startCursor: null, endCursor: null },
    });

    try {
      const result: FetchListingsResult =
        await fetchMarketplaceListings(appliedFilter, null);

      set({
        listings: result.listings,
        pageInfo: {
          hasNextPage: result.pageInfo.hasNextPage,
          startCursor: result.listings[0]?.id ?? null,
          endCursor: result.pageInfo.endCursor,
        },
        totalCount: result.totalCount,
        isLoading: false,
      });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to fetch listings",
        isLoading: false,
      });
    }
  },

  fetchNextPage: async () => {
    const { pageInfo, isLoadingMore, isLoading, filter, listings } = get();

    if (isLoadingMore || isLoading || !pageInfo.hasNextPage) return;

    set({ isLoadingMore: true });

    try {
      const result: FetchListingsResult =
        await fetchMarketplaceListings(filter, pageInfo.endCursor);

      // Deduplicate: backend may return items already in the list
      const existingIds = new Set(listings.map((l) => l.id));
      const newItems = result.listings.filter((l) => !existingIds.has(l.id));

      set({
        listings: [...listings, ...newItems],
        pageInfo: {
          hasNextPage: result.pageInfo.hasNextPage,
          startCursor: pageInfo.startCursor,
          endCursor: result.pageInfo.endCursor,
        },
        totalCount: result.totalCount,
        isLoadingMore: false,
      });
    } catch (err) {
      set({
        error:
          err instanceof Error ? err.message : "Failed to load more listings",
        isLoadingMore: false,
      });
    }
  },

  refreshListings: async () => {
    const { filter } = get();

    set({ isRefreshing: true, error: null });

    try {
      const result: FetchListingsResult =
        await fetchMarketplaceListings(filter, null);

      set({
        listings: result.listings,
        pageInfo: {
          hasNextPage: result.pageInfo.hasNextPage,
          startCursor: result.listings[0]?.id ?? null,
          endCursor: result.pageInfo.endCursor,
        },
        totalCount: result.totalCount,
        isRefreshing: false,
      });
    } catch (err) {
      set({
        error:
          err instanceof Error ? err.message : "Failed to refresh listings",
        isRefreshing: false,
      });
    }
  },

  updateFilter: (partialFilter: Partial<MarketplaceFilter>) => {
    const { filter } = get();
    const newFilter = { ...filter, ...partialFilter };
    // Trigger a fresh fetch with new filter — fetchListings applies the filter to state
    get().fetchListings(newFilter);
  },

  setSearch: (search: string) => {
    const { filter } = get();
    set({ filter: { ...filter, search } });
    // Debounce is handled by the component (FilterBar)
  },

  clearFilters: () => {
    set({ filter: { ...DEFAULT_FILTER } });
    get().fetchListings(DEFAULT_FILTER);
  },
}));

// Selector hook for marketplace state
export const useMarketplace = () =>
  useMarketplaceStore((state) => ({
    listings: state.listings,
    pageInfo: state.pageInfo,
    totalCount: state.totalCount,
    isLoading: state.isLoading,
    isLoadingMore: state.isLoadingMore,
    isRefreshing: state.isRefreshing,
    error: state.error,
    filter: state.filter,
    fetchListings: state.fetchListings,
    fetchNextPage: state.fetchNextPage,
    refreshListings: state.refreshListings,
    updateFilter: state.updateFilter,
    setSearch: state.setSearch,
    clearFilters: state.clearFilters,
  }));
