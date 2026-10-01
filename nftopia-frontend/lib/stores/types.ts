// Auth Store Types
export interface User {
  id?: string;
  sub?: string;
  address?: string;
  walletAddress: string;
  walletProvider?: string;
  isArtist?: boolean;
  username?: string;
  email?: string;
  profileImage?: string;
  avatarUrl?: string;
  bannerUrl?: string;
  twitterHandle?: string;
  instagramHandle?: string;
  website?: string;
  bio?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthState {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  error: string | null;
}

export interface AuthActions {
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  requestNonce: (walletAddress: string) => Promise<string>;
  verifySignature: (walletAddress: string, signature: [string, string]) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

export type AuthStore = {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  accessToken: string | null;
  refreshTokenValue: string | null;

  // Setters
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;

  // Email auth
  register: (email: string, password: string, username?: string) => Promise<void>;
  emailLogin: (email: string, password: string) => Promise<void>;

  // Wallet auth
  getWalletChallenge: (walletAddress: string, walletProvider?: string) => Promise<unknown>;
  verifyWalletSignature: (walletAddress: string, nonce: string, signature: string, walletProvider?: string) => Promise<void>;
  linkWallet: (walletAddress: string, nonce: string, signature: string, walletProvider?: string) => Promise<unknown>;
  unlinkWallet: (walletAddress: string) => Promise<unknown>;
  listWallets: () => Promise<unknown>;

  // Legacy Starknet methods (kept for backward compat)
  requestNonce: (walletAddress: string) => Promise<string>;
  verifySignature: (
    walletAddress: string,
    signature: [string, string],
    nonce: string,
    walletProvider: 'freighter' | 'albedo' | 'walletconnect',
    locale: string
  ) => Promise<void>;

  // Token / session
  refreshToken: () => Promise<string>;
  isAccessTokenExpired: () => boolean;
  getCurrentUser: () => User | null;

  logout: () => Promise<void>;
};

// Collection Store Types
export interface Collection {
  id: string | number;
  name: string;
  description: string;
  coverImage?: string;
  bannerImage?: string;
  nftCount: number;
  floorPrice: number;
  totalVolume: number;
  createdAt: string;
  updatedAt?: string;
  creatorId?: string;
  isVerified?: boolean;
  category?: string;
}

export interface NFT {
  id: string;
  name: string;
  description: string;
  image: string;
  price: string;
  creator: string;
  collectionId?: string;
  tokenId?: string;
  isListed: boolean;
  likes: number;
  views: number;
  attributes?: Array<{
    trait_type: string;
    value: string | number | boolean;
  }>;
  createdAt: string;
  updatedAt?: string;
}

export interface CollectionState {
  collections: Collection[];
  userCollections: Collection[];
  currentCollection: Collection | null;
  nfts: NFT[];
  userNFTs: NFT[];
  loading: {
    collections: boolean;
    userCollections: boolean;
    nfts: boolean;
    userNFTs: boolean;
    creating: boolean;
    updating: boolean;
  };
  error: string | null;
  pagination: {
    collections: {
      page: number;
      limit: number;
      total: number;
      hasMore: boolean;
    };
    nfts: {
      page: number;
      limit: number;
      total: number;
      hasMore: boolean;
    };
  };
}

export interface CollectionActions {
  setCollections: (collections: Collection[]) => void;
  addCollection: (collection: Collection) => void;
  updateCollection: (id: string | number, updates: Partial<Collection>) => void;
  removeCollection: (id: string | number) => void;
  setCurrentCollection: (collection: Collection | null) => void;
  setUserCollections: (collections: Collection[]) => void;
  setNFTs: (nfts: NFT[]) => void;
  addNFT: (nft: NFT) => void;
  updateNFT: (id: string, updates: Partial<NFT>) => void;
  removeNFT: (id: string) => void;
  setUserNFTs: (nfts: NFT[]) => void;
  setLoading: (key: keyof CollectionState['loading'], loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  setPagination: (
    type: 'collections' | 'nfts',
    pagination: Partial<CollectionState['pagination']['collections'] | CollectionState['pagination']['nfts']>
  ) => void;
  fetchCollections: () => Promise<void>;
  fetchUserCollections: () => Promise<void>;
  fetchNFTs: (collectionId?: string) => Promise<void>;
  fetchUserNFTs: () => Promise<void>;
  createCollection: (collection: Omit<Collection, 'id' | 'createdAt'>) => Promise<Collection>;
  createNFT: (nft: Omit<NFT, 'id' | 'createdAt'>) => Promise<NFT>;
}

export type CollectionStore = CollectionState & CollectionActions;

export interface Theme {
  mode: 'light' | 'dark' | 'system';
  primaryColor: string;
  fontFamily: string;
}

export interface NotificationSettings {
  email: boolean;
  push: boolean;
  newListings: boolean;
  priceUpdates: boolean;
  bidActivity: boolean;
  auctions: boolean;
}

export interface DisplaySettings {
  gridView: 'grid' | 'list';
  itemsPerPage: number;
  showPrice: boolean;
  showCreator: boolean;
  showLikes: boolean;
  currency: 'ETH' | 'STRK' | 'USD';
}

export interface PreferencesState {
  theme: Theme;
  notifications: NotificationSettings;
  display: DisplaySettings;
  language: string;
  timezone: string;
  recentSearches: string[];
  favoriteCollections: string[];
  favoriteNFTs: string[];
  watchlist: string[];
  isHydrated: boolean;
}

export interface PreferencesActions {
  setTheme: (theme: Partial<Theme>) => void;
  setNotifications: (notifications: Partial<NotificationSettings>) => void;
  setDisplay: (display: Partial<DisplaySettings>) => void;
  setLanguage: (language: string) => void;
  setTimezone: (timezone: string) => void;
  addRecentSearch: (search: string) => void;
  clearRecentSearches: () => void;
  addToFavorites: (collectionId: string) => void;
  removeFromFavorites: (collectionId: string) => void;
  addToFavoriteNFTs: (nftId: string) => void;
  removeFromFavoriteNFTs: (nftId: string) => void;
  toggleFavoriteNFT: (nftId: string) => void;
  addToWatchlist: (nftId: string) => void;
  removeFromWatchlist: (nftId: string) => void;
  resetPreferences: () => void;
  setHydrated: (hydrated: boolean) => void;
}

export type PreferencesStore = PreferencesState & PreferencesActions;

export interface AppState {
  isOnline: boolean;
  sidebarOpen: boolean;
  modalStack: string[];
  toast: {
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
    id: string;
  } | null;
  searchQuery: string;
  searchFilters: {
    category: string;
    priceRange: [number, number];
    sortBy: 'newest' | 'oldest' | 'price_low' | 'price_high' | 'most_liked';
  };
}

export interface AppActions {
  setOnline: (online: boolean) => void;
  setSidebarOpen: (open: boolean) => void;
  pushModal: (modalId: string) => void;
  popModal: () => void;
  clearModals: () => void;
  showToast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  hideToast: () => void;
  setSearchQuery: (query: string) => void;
  setSearchFilters: (filters: Partial<AppState['searchFilters']>) => void;
  resetSearchFilters: () => void;
}

export type AppStore = AppState & AppActions;

// Notification Store Types
export type NotificationType = 'bid' | 'sale' | 'follow' | 'system' | 'like' | 'auction';

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  timestamp: string;
  read: boolean;
  link?: string;
  metadata?: Record<string, unknown>;
}

export interface NotificationState {
  notifications: NotificationItem[];
  isHydrated: boolean;
}

export interface NotificationActions {
  addNotification: (
    notification: Omit<NotificationItem, 'id' | 'timestamp' | 'read'> & Partial<Pick<NotificationItem, 'id' | 'timestamp' | 'read'>>
  ) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
  setHydrated: (hydrated: boolean) => void;
}

export type NotificationStore = NotificationState & NotificationActions;

export interface RootStore {
  auth: AuthStore;
  collections: CollectionStore;
  preferences: PreferencesStore;
  app: AppStore;
  notifications: NotificationStore;
}

