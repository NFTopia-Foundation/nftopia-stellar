import { useCallback } from 'react';
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { PreferencesStore, DisplaySettings } from './types';
import { formatCurrencyAmount } from '../currency';

const initialState = {
  theme: {
    mode: 'dark' as const,
    primaryColor: '#8B5CF6',
    fontFamily: 'Inter',
  },
  notifications: {
    email: true,
    push: true,
    newListings: true,
    priceUpdates: true,
    bidActivity: true,
    auctions: true,
  },
  display: {
    gridView: 'grid' as const,
    itemsPerPage: 12,
    showPrice: true,
    showCreator: true,
    showLikes: true,
    currency: 'XLM' as const,
  },
  language: 'en',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  recentSearches: [],
  favoriteCollections: [],
  favoriteNFTs: [],
  watchlist: [],
  isHydrated: false,
};

export const usePreferencesStore = create<PreferencesStore>()(
  devtools(
    persist(
      immer((set, get) => ({
        ...initialState,

        // Theme actions
        setTheme: (theme) =>
          set((state) => {
            state.theme = { ...state.theme, ...theme };
          }),

        // Notification actions
        setNotifications: (notifications) =>
          set((state) => {
            state.notifications = { ...state.notifications, ...notifications };
          }),

        // Display actions
        setDisplay: (display) =>
          set((state) => {
            state.display = { ...state.display, ...display };
          }),

        // Language actions
        setLanguage: (language) =>
          set((state) => {
            state.language = language;
          }),

        // Timezone actions
        setTimezone: (timezone) =>
          set((state) => {
            state.timezone = timezone;
          }),

        // Recent searches
        addRecentSearch: (search) =>
          set((state) => {
            // Remove if already exists
            state.recentSearches = state.recentSearches.filter((s) => s !== search);
            // Add to beginning
            state.recentSearches.unshift(search);
            // Keep only last 10 searches
            state.recentSearches = state.recentSearches.slice(0, 10);
          }),

        clearRecentSearches: () =>
          set((state) => {
            state.recentSearches = [];
          }),

        // Favorites (Collections)
        addToFavorites: (collectionId) =>
          set((state) => {
            if (!state.favoriteCollections) state.favoriteCollections = [];
            if (!state.favoriteCollections.includes(collectionId)) {
              state.favoriteCollections.push(collectionId);
            }
          }),

        removeFromFavorites: (collectionId) =>
          set((state) => {
            if (!state.favoriteCollections) state.favoriteCollections = [];
            state.favoriteCollections = state.favoriteCollections.filter(
              (id) => id !== collectionId
            );
          }),

        // Favorites (NFTs)
        addToFavoriteNFTs: (nftId) =>
          set((state) => {
            if (!state.favoriteNFTs) state.favoriteNFTs = [];
            if (!state.favoriteNFTs.includes(nftId)) {
              state.favoriteNFTs.push(nftId);
            }
          }),

        removeFromFavoriteNFTs: (nftId) =>
          set((state) => {
            if (!state.favoriteNFTs) state.favoriteNFTs = [];
            state.favoriteNFTs = state.favoriteNFTs.filter((id) => id !== nftId);
          }),

        toggleFavoriteNFT: (nftId) =>
          set((state) => {
            if (!state.favoriteNFTs) state.favoriteNFTs = [];
            state.favoriteNFTs = state.favoriteNFTs.includes(nftId)
              ? state.favoriteNFTs.filter((id) => id !== nftId)
              : [...state.favoriteNFTs, nftId];
          }),

        // Watchlist
        addToWatchlist: (nftId) =>
          set((state) => {
            if (!state.watchlist) state.watchlist = [];
            if (!state.watchlist.includes(nftId)) {
              state.watchlist.push(nftId);
            }
          }),

        removeFromWatchlist: (nftId) =>
          set((state) => {
            if (!state.watchlist) state.watchlist = [];
            state.watchlist = state.watchlist.filter((id) => id !== nftId);
          }),

        // Reset preferences
        resetPreferences: () =>
          set((state) => {
            Object.assign(state, {
              ...initialState,
              isHydrated: true, // Keep hydration state
            });
          }),

        // Hydration state
        setHydrated: (hydrated) =>
          set((state) => {
            state.isHydrated = hydrated;
          }),
      })),
      {
        name: 'nftopia-preferences',
        version: 2,
        // v1 -> v2: the default/display currency used to be the stale
        // Starknet-era 'STRK' (with 'ETH' also a leftover option) — coerce
        // any already-persisted value from either to the new default so
        // existing users don't keep a currency that's no longer a valid
        // option (#660).
        migrate: (persistedState, version) => {
          const state = persistedState as { display?: { currency?: string } };
          if (version < 2 && state?.display && state.display.currency !== 'USD') {
            state.display.currency = 'XLM';
          }
          return state as typeof initialState;
        },
        onRehydrateStorage: () => (state) => {
          state?.setHydrated(true);
        },
        partialize: (state) => ({
          theme: state.theme,
          notifications: state.notifications,
          display: state.display,
          language: state.language,
          timezone: state.timezone,
          recentSearches: state.recentSearches,
          favoriteCollections: state.favoriteCollections || [],
          favoriteNFTs: state.favoriteNFTs || [],
          watchlist: state.watchlist || [],
        }),
      }
    ),
    {
      name: 'preferences-store',
    }
  )
);

// Hooks for specific preference sections
export const useTheme = () => {
  const { theme, setTheme } = usePreferencesStore();
  return { theme, setTheme };
};

export const useNotifications = () => {
  const { notifications, setNotifications } = usePreferencesStore();
  return { notifications, setNotifications };
};

export const useDisplaySettings = () => {
  const { display, setDisplay } = usePreferencesStore();
  return { display, setDisplay };
};

/**
 * The hook balance/price-displaying components should use (#660) instead
 * of hardcoding a unit: reads the global currency preference and exposes a
 * `format` helper that converts an amount already denominated in XLM into
 * that preference's display form.
 */
export const useDisplayCurrency = () => {
  const currency = usePreferencesStore((state) => state.display.currency);
  const setDisplay = usePreferencesStore((state) => state.setDisplay);

  const setCurrency = useCallback(
    (next: DisplaySettings['currency']) => setDisplay({ currency: next }),
    [setDisplay]
  );

  const format = useCallback(
    (amountXlm: number | string | null | undefined) =>
      formatCurrencyAmount(amountXlm, currency),
    [currency]
  );

  return { currency, setCurrency, format };
};

export const useFavorites = () => {
  const {
    favoriteCollections,
    favoriteNFTs = [],
    addToFavorites,
    removeFromFavorites,
    addToFavoriteNFTs,
    removeFromFavoriteNFTs,
    toggleFavoriteNFT,
    isHydrated,
  } = usePreferencesStore();

  const isFavorite = (id: string, type: 'nft' | 'collection' = 'collection') => {
    if (type === 'collection') {
      return (favoriteCollections || []).includes(id);
    }
    return (favoriteNFTs || []).includes(id);
  };

  const toggleFavorite = (id: string, type: 'nft' | 'collection' = 'collection') => {
    if (type === 'collection') {
      if (isFavorite(id, 'collection')) {
        removeFromFavorites(id);
      } else {
        addToFavorites(id);
      }
    } else {
      toggleFavoriteNFT(id);
    }
  };

  return {
    favoriteCollections: favoriteCollections || [],
    favoriteNFTs: favoriteNFTs || [],
    isFavorite,
    toggleFavorite,
    addToFavorites,
    removeFromFavorites,
    addToFavoriteNFTs,
    removeFromFavoriteNFTs,
    toggleFavoriteNFT,
    isHydrated,
  };
};

export const useWatchlist = () => {
  const { watchlist, addToWatchlist, removeFromWatchlist } = usePreferencesStore();
  
  const isWatched = (nftId: string) => watchlist.includes(nftId);
  const toggleWatchlist = (nftId: string) => {
    if (isWatched(nftId)) {
      removeFromWatchlist(nftId);
    } else {
      addToWatchlist(nftId);
    }
  };

  return {
    watchlist,
    isWatched,
    toggleWatchlist,
    addToWatchlist,
    removeFromWatchlist,
  };
};

export const useRecentSearches = () => {
  const { recentSearches, addRecentSearch, clearRecentSearches } = usePreferencesStore();
  return { recentSearches, addRecentSearch, clearRecentSearches };
};

// Hook for easier preferences access
export const usePreferences = () => {
  const {
    theme,
    notifications,
    display,
    language,
    timezone,
    isHydrated,
    setTheme,
    setNotifications,
    setDisplay,
    setLanguage,
    setTimezone,
    resetPreferences,
  } = usePreferencesStore();

  return {
    theme,
    notifications,
    display,
    language,
    timezone,
    isHydrated,
    setTheme,
    setNotifications,
    setDisplay,
    setLanguage,
    setTimezone,
    resetPreferences,
  };
}; 
