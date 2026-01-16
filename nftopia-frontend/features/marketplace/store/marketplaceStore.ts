import type { StateCreator } from "zustand";
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

// --- Types ---
interface MarketplaceListing {
  id: string;
  nftId: string;
  price: string;
  seller: string;
  status: "active" | "sold" | "cancelled";
  createdAt: string;
}

interface MarketplaceState {
  listings: MarketplaceListing[];
  filters: {
    priceRange: [number, number];
    status: "active" | "sold" | "cancelled" | "all";
  };
  loading: boolean;
  error: string | null;
}

interface MarketplaceActions {
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
          set((state) => ({
            ...state,
            filters: { ...state.filters, ...filters },
          })),
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
    setListings: state.setListings,
    addListing: state.addListing,
    updateListing: state.updateListing,
    removeListing: state.removeListing,
    setFilters: state.setFilters,
    setLoading: state.setLoading,
    setError: state.setError,
    clearError: state.clearError,
  }));
