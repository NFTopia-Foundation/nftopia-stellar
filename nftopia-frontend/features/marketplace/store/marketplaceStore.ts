import type { StateCreator } from "zustand";
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import type {
  MarketplaceListing as MarketplaceListingItem,
  MarketplaceListingsFilter,
  MarketplaceListingsPage,
} from "../api/marketplace-listings";

// --- Types ---
interface MarketplaceListing {
  id: string;
  nftId: string;
  price: string;
  seller: string;
  status: "active" | "sold" | "cancelled";
  createdAt: string;
}

/** Loads one page of listings. Injected so the store stays transport-agnostic. */
export type MarketplacePageLoader = (params: {
  cursor: string | null;
  limit: number;
  filter?: MarketplaceListingsFilter;
}) => Promise<MarketplaceListingsPage>;

export const DEFAULT_MARKETPLACE_PAGE_SIZE = 20;

/**
 * Cursor-pagination state for the marketplace listing grid.
 *
 * `items` is *appended* to on every page (never replaced), which is what makes
 * "load more" and infinite scroll accumulate rather than flicker.
 */
interface MarketplacePaginationState {
  items: MarketplaceListingItem[];
  /** Cursor of the last loaded page; `null` means "no page loaded yet". */
  cursor: string | null;
  hasNextPage: boolean;
  totalCount: number;
  /** A subsequent page is in flight. */
  isLoadingMore: boolean;
  /** The first page (or the page after a filter change) is in flight. */
  isLoadingFirstPage: boolean;
  /** Failed page load, surfaced with a retry affordance. */
  paginationError: string | null;
  pageSize: number;
  paginationFilter: MarketplaceListingsFilter;
  pageLoader: MarketplacePageLoader | null;
}

interface MarketplacePaginationActions {
  /** Registers the transport used by `loadFirstPage` / `loadMore`. */
  configurePagination: (config: {
    loader: MarketplacePageLoader;
    pageSize?: number;
  }) => void;
  loadFirstPage: () => Promise<void>;
  loadMore: () => Promise<void>;
  /** Replaces the server-side filter and restarts from page 1. */
  setPaginationFilter: (filter: MarketplaceListingsFilter) => void;
  /** Clears every page back to the initial state (filter change, reset). */
  resetPagination: () => void;
}

interface MarketplaceState extends MarketplacePaginationState {
  listings: MarketplaceListing[];
  filters: {
    priceRange: [number, number];
    status: "active" | "sold" | "cancelled" | "all";
  };
  loading: boolean;
  error: string | null;
}

interface MarketplaceActions extends MarketplacePaginationActions {
  setListings: (listings: MarketplaceListing[]) => void;
  addListing: (listing: MarketplaceListing) => void;
  updateListing: (id: string, updates: Partial<MarketplaceListing>) => void;
  removeListing: (id: string) => void;
  setFilters: (filters: Partial<MarketplaceState["filters"]>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

export type MarketplaceStore = MarketplaceState & MarketplaceActions;

/** The state a paged list falls back to whenever it restarts from page 1. */
const emptyPaginationState: MarketplacePaginationState = {
  items: [],
  cursor: null,
  hasNextPage: false,
  totalCount: 0,
  isLoadingMore: false,
  isLoadingFirstPage: false,
  paginationError: null,
  pageSize: DEFAULT_MARKETPLACE_PAGE_SIZE,
  paginationFilter: {},
  pageLoader: null,
};

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "Could not load more listings";
}

// --- Logging Middleware ---
const logMiddleware =
  <T extends object>(
    config: StateCreator<T, [], [], T>
  ): StateCreator<T, [], [], T> =>
  (set, get, api) =>
    config(
      (partial, replace) => {
        if (
          typeof process !== "undefined" &&
          typeof (process as any).env !== "undefined" &&
          (process as any).env.NODE_ENV === "development"
        ) {
          console.log("[Store action]", partial);
        }
        set(partial, replace as false | undefined);
      },
      get,
      api
    );

const initialState: MarketplaceState = {
  ...emptyPaginationState,
  listings: [],
  filters: {
    priceRange: [0, 1000],
    status: "all",
  },
  loading: false,
  error: null,
};

export const useMarketplaceStore = create<MarketplaceStore>()(
  devtools(
    immer(
      logMiddleware<MarketplaceStore>((set, get) => ({
        ...initialState,

        // --- Cursor pagination -------------------------------------------------
        configurePagination: ({ loader, pageSize }) =>
          set((state) => ({
            ...state,
            pageLoader: loader,
            pageSize: pageSize && pageSize > 0 ? pageSize : state.pageSize,
          })),

        resetPagination: () =>
          set((state) => ({
            ...state,
            ...emptyPaginationState,
            // The transport and its configuration survive a reset.
            pageLoader: state.pageLoader,
            pageSize: state.pageSize,
            paginationFilter: state.paginationFilter,
          })),

        setPaginationFilter: (filter) =>
          set((state) => {
            if (
              JSON.stringify(filter ?? {}) ===
              JSON.stringify(state.paginationFilter ?? {})
            ) {
              return state;
            }
            // A different filter means a different result set: drop every page
            // so the list restarts at page 1.
            return {
              ...state,
              ...emptyPaginationState,
              pageLoader: state.pageLoader,
              pageSize: state.pageSize,
              paginationFilter: filter,
            };
          }),

        loadFirstPage: async () => {
          const { pageLoader, isLoadingFirstPage, pageSize, paginationFilter } =
            get();
          // No transport registered, or a first page is already in flight.
          if (!pageLoader || isLoadingFirstPage) return;

          set((state) => ({
            ...state,
            ...emptyPaginationState,
            pageLoader: state.pageLoader,
            pageSize: state.pageSize,
            paginationFilter: state.paginationFilter,
            isLoadingFirstPage: true,
          }));

          try {
            const page = await pageLoader({
              cursor: null,
              limit: pageSize,
              filter: paginationFilter,
            });
            set((state) => ({
              ...state,
              items: page.items,
              cursor: page.nextCursor,
              hasNextPage: page.hasNextPage,
              totalCount: page.totalCount,
              isLoadingFirstPage: false,
              paginationError: null,
            }));
          } catch (error) {
            set((state) => ({
              ...state,
              ...emptyPaginationState,
              pageLoader: state.pageLoader,
              pageSize: state.pageSize,
              paginationFilter: state.paginationFilter,
              paginationError: toErrorMessage(error),
            }));
          }
        },

        loadMore: async () => {
          const {
            pageLoader,
            hasNextPage,
            isLoadingMore,
            isLoadingFirstPage,
            cursor,
            pageSize,
            paginationFilter,
          } = get();

          // Nothing left to load, a request already in flight, or no transport.
          if (!pageLoader || !hasNextPage || isLoadingMore || isLoadingFirstPage)
            return;

          set((state) => ({
            ...state,
            isLoadingMore: true,
            paginationError: null,
          }));

          try {
            const page = await pageLoader({
              cursor,
              limit: pageSize,
              filter: paginationFilter,
            });
            set((state) => {
              // Append (never replace) and drop rows we already have, so a
              // cursor that overlaps a previous page cannot duplicate items.
              const known = new Set(state.items.map((item) => item.id));
              const additions = page.items.filter(
                (item) => !known.has(item.id),
              );
              return {
                ...state,
                items: [...state.items, ...additions],
                cursor: page.nextCursor,
                hasNextPage: page.hasNextPage,
                totalCount: page.totalCount,
                isLoadingMore: false,
                paginationError: null,
              };
            });
          } catch (error) {
            // Keep the cursor as-is so "retry" re-requests the same page.
            set((state) => ({
              ...state,
              isLoadingMore: false,
              paginationError: toErrorMessage(error),
            }));
          }
        },

        setListings: (listings) => set((state) => ({ ...state, listings })),
        addListing: (listing) =>
          set((state) => ({
            ...state,
            listings: [listing, ...state.listings],
          })),
        updateListing: (id, updates) =>
          set((state) => ({
            ...state,
            listings: state.listings.map((l) =>
              l.id === id ? { ...l, ...updates } : l
            ),
          })),
        removeListing: (id) =>
          set((state) => ({
            ...state,
            listings: state.listings.filter((l) => l.id !== id),
          })),
        setFilters: (filters) =>
          set((state) => {
            const merged = { ...state.filters, ...filters };
            if (JSON.stringify(merged) === JSON.stringify(state.filters)) {
              return state;
            }
            // Changing filters invalidates every loaded page, so the list
            // restarts from page 1.
            return {
              ...state,
              filters: merged,
              ...emptyPaginationState,
              pageLoader: state.pageLoader,
              pageSize: state.pageSize,
              paginationFilter: state.paginationFilter,
            };
          }),
        setLoading: (loading) => set((state) => ({ ...state, loading })),
        setError: (error) => set((state) => ({ ...state, error })),
        clearError: () => set((state) => ({ ...state, error: null })),
      }))
    ),
    { name: "marketplace-store" }
  )
);

export const useMarketplace = () =>
  useMarketplaceStore((state) => ({
    listings: state.listings,
    filters: state.filters,
    loading: state.loading,
    error: state.error,
    items: state.items,
    cursor: state.cursor,
    hasNextPage: state.hasNextPage,
    totalCount: state.totalCount,
    isLoadingMore: state.isLoadingMore,
    isLoadingFirstPage: state.isLoadingFirstPage,
    paginationError: state.paginationError,
    paginationFilter: state.paginationFilter,
    setListings: state.setListings,
    addListing: state.addListing,
    updateListing: state.updateListing,
    removeListing: state.removeListing,
    setFilters: state.setFilters,
    setLoading: state.setLoading,
    setError: state.setError,
    clearError: state.clearError,
    configurePagination: state.configurePagination,
    loadFirstPage: state.loadFirstPage,
    loadMore: state.loadMore,
    resetPagination: state.resetPagination,
    setPaginationFilter: state.setPaginationFilter,
  }));
