// Types
export * from "./types";

// Auth Store
export { initializeAuth, useAuth, useAuthStore } from "./auth-store";

// Collection Store
export { useCollections, useCollectionStore } from "./collection-store";

// Preferences Store
export {
  useDisplaySettings,
  useFavorites,
  useNotifications,
  usePreferences,
  usePreferencesStore,
  useRecentSearches,
  useTheme,
  useWatchlist,
} from "./preferences-store";

// App Store
export {
  useAppState,
  useAppStore,
  useModals,
  useOnlineStatus,
  useSearch,
  useSidebar,
  useToast,
} from "./app-store";

export { useMarketplace } from "../../features/marketplace/store/marketplaceStore";
export { useNFTs } from "../../features/nft/store/nftStore";
export { useUser, useUserProfile } from "../../features/user/store/userStore";
export { useStore } from "../../hooks/useStore";

// Store initialization helper
import { initializeAuth } from "./auth-store";
export const initializeStores = async () => {
  try {
    await initializeAuth();
  } catch (error) {
    console.error("Failed to initialize stores:", error);
  }
};
