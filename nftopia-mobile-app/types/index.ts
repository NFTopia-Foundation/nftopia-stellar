// ============================================================
// Core Types
// ============================================================

export interface User {
  id: string;
  address: string;
  username?: string;
  avatarUrl?: string;
}

export interface NFTAttribute {
  trait_type: string;
  value: string;
}

export interface TransferEvent {
  id: string;
  type: 'mint' | 'transfer' | 'sale';
  fromAddress?: string;
  toAddress: string;
  date: string;
  price?: string;
  transactionHash: string;
}

// ============================================================
// NFT Types
// ============================================================

export interface NFT {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  price: string;
  currency: string;
  contractAddress: string;
  collectionId?: string;
  creatorId: string;
  ownerId: string;
  status: 'draft' | 'minted' | 'listed' | 'sold';
  createdAt: string;
  updatedAt: string;
  metadata?: NFTMetadata;
  creator: User;
  owner: User;
  collection?: Collection;
  attributes: NFTAttribute[];
  history: TransferEvent[];
}

export interface NFTMetadata {
  name: string;
  description: string;
  image: string;
  attributes?: NFTAttribute[];
  external_url?: string;
}

// ============================================================
// Collection Types
// ============================================================

export interface Collection {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  bannerUrl?: string;
  creatorId: string;
  creator: User;
  contractAddress?: string;
  nftCount: number;
  floorPrice?: string;
  volumeTraded?: string;
  isVerified?: boolean;
  isLiked?: boolean;
  likeCount?: number;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// Creator Dashboard Types
// ============================================================

export interface DashboardStats {
  totalNfts: number;
  totalCollections: number;
  totalEarnings: string;
  totalSales: number;
  floorPrice: string;
  volumeTraded: string;
}

export interface ActivityEvent {
  id: string;
  type: 'sale' | 'purchase' | 'mint' | 'listing' | 'offer' | 'transfer' | 'follow' | 'like' | 'bid';
  nftId: string;
  nftName: string;
  nftImage: string;
  from?: string;
  to?: string;
  price?: string;
  currency?: string;
  timestamp: string;
  status?: 'pending' | 'confirmed' | 'failed';
}

export interface Transaction {
  id: string;
  type: 'sale' | 'purchase' | 'mint' | 'royalty';
  nftId: string;
  nftName: string;
  nftImage: string;
  amount: string;
  currency: string;
  from: string;
  to: string;
  timestamp: string;
  status: 'pending' | 'completed' | 'failed';
  txHash?: string;
}

// ============================================================
// Notification Types
// ============================================================

/**
 * Shared taxonomy of notification categories the backend/push service can
 * emit. This is the single source of truth for category identifiers — the
 * notification list, the preferences store, and the settings screen all key
 * off these same string values instead of re-declaring the list separately.
 *
 * A string-literal union (not a `enum`) so every existing place that already
 * constructs a notification with a raw string like `type: 'outbid'` keeps
 * compiling unchanged — this is purely additive, it does not rename or
 * re-type anything that already worked.
 */
export type NotificationCategory =
  | 'outbid'
  | 'sale'
  | 'follow'
  | 'mint'
  | 'auction_end'
  | 'listing'
  | 'offer'
  | 'transfer';

export const NOTIFICATION_CATEGORIES: NotificationCategory[] = [
  'outbid',
  'sale',
  'follow',
  'mint',
  'auction_end',
  'listing',
  'offer',
  'transfer',
];

export interface Notification {
  id: string;
  type: NotificationCategory;
  title: string;
  message: string;
  data?: {
    nftId?: string;
    nftName?: string;
    nftImage?: string;
    userId?: string;
    userName?: string;
    amount?: string;
    currency?: string;
  };
  read: boolean;
  createdAt: string;
}

/**
 * Display metadata for each notification category, grouped the same way the
 * settings screen sections its toggles. This is the one place a category's
 * label/description/section lives — add a category here and it shows up in
 * the settings screen automatically.
 */
export const NOTIFICATION_CATEGORY_META: Record<
  NotificationCategory,
  { label: string; description: string; section: 'Marketplace' | 'Social' | 'Creation' }
> = {
  outbid: {
    label: 'Outbid',
    description: 'When someone outbids you on an NFT',
    section: 'Marketplace',
  },
  sale: {
    label: 'Sale',
    description: 'When one of your NFTs is sold',
    section: 'Marketplace',
  },
  listing: {
    label: 'Listing',
    description: "When an NFT you're watching is listed",
    section: 'Marketplace',
  },
  offer: {
    label: 'Offer',
    description: 'When you receive an offer on an NFT',
    section: 'Marketplace',
  },
  auction_end: {
    label: 'Auction Ending',
    description: "When an auction you're in is about to end",
    section: 'Marketplace',
  },
  follow: {
    label: 'Follows',
    description: 'When someone follows you',
    section: 'Social',
  },
  mint: {
    label: 'Minting',
    description: 'When your NFT is successfully minted',
    section: 'Creation',
  },
  transfer: {
    label: 'Transfers',
    description: 'When an NFT is transferred to or from you',
    section: 'Creation',
  },
};

/**
 * A do-not-disturb window. `start`/`end` are 24-hour "HH:mm" clock times in
 * the device's local timezone. The window may cross midnight (`start` later
 * than `end`, e.g. "22:00"–"08:00") — see `isWithinQuietHours` for how that's
 * resolved. Only the hour component is exposed in the UI today (minutes are
 * always "00"); see NOTIFICATION-PREFERENCES-SYNC.md for why.
 */
export interface QuietHours {
  enabled: boolean;
  start: string;
  end: string;
}

export interface NotificationPreferences {
  outbid: boolean;
  sale: boolean;
  follow: boolean;
  mint: boolean;
  auction_end: boolean;
  listing: boolean;
  offer: boolean;
  transfer: boolean;
  pushEnabled: boolean;
  quietHours: QuietHours;
}

// ============================================================
// Offline Types
// ============================================================

export interface OfflineQueueItem {
  id: string;
  action: string;
  payload: any;
  timestamp: string;
  retryCount: number;
  maxRetries: number;
}

export interface CachedData {
  nfts: NFT[];
  collections: Collection[];
  notifications: Notification[];
  favorites: string[];
  watchlist: string[];
  recentSearches: string[];
  lastSync: string;
}

// ============================================================
// Minting Types
// ============================================================

export interface MintFormData {
  name: string;
  description: string;
  price: string;
  currency: string;
  collectionId?: string;
  contractAddress: string;
  image: string | null;
  attributes?: NFTAttribute[];
}

export interface MintState {
  loading: boolean;
  uploading: boolean;
  progress: number;
  error: string | null;
  success: boolean;
  mintedNft?: NFT;
}

// ============================================================
// Search Types
// ============================================================

export interface SearchResult {
  nfts: NFT[];
  collections: Collection[];
  creators: CreatorProfile[];
  totalCount: number;
}

export interface SearchFilters {
  type: 'all' | 'nfts' | 'collections' | 'creators';
  category?: string;
  minPrice?: string;
  maxPrice?: string;
  sortBy?: 'relevance' | 'recent' | 'price_low' | 'price_high';
}

// ============================================================
// Creator Profile Types
// ============================================================

export interface CreatorProfile {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  bannerUrl?: string;
  bio?: string;
  website?: string;
  twitter?: string;
  instagram?: string;
  isVerified: boolean;
  isFollowing: boolean;
  followerCount: number;
  followingCount: number;
  nftCount: number;
  collectionCount: number;
  totalVolume: string;
  walletAddress: string;
  createdAt: string;
}

// ============================================================
// Auction Types
// ============================================================

export interface Auction {
  id: string;
  nftId: string;
  nftName: string;
  nftImage: string;
  creatorId: string;
  creatorName: string;
  creatorAvatar: string;
  startPrice: string;
  currentPrice: string;
  reservePrice?: string;
  currency: string;
  startTime: string;
  endTime: string;
  status: 'active' | 'ending_soon' | 'ended' | 'settled' | 'cancelled';
  bidCount: number;
  topBidder?: string;
  isWatched: boolean;
}

export interface Bid {
  id: string;
  auctionId: string;
  bidderId: string;
  bidderName: string;
  bidderAvatar: string;
  amount: string;
  currency: string;
  timestamp: string;
  isWinning: boolean;
}

export interface AuctionFormData {
  nftId: string;
  startPrice: string;
  reservePrice?: string;
  currency: string;
  duration: number; // in hours
  startTime?: string;
}

// ============================================================
// Telemetry Types
// ============================================================

export interface TelemetryEvent {
  event: string;
  properties?: Record<string, any>;
  timestamp: string;
}

// ============================================================
// Navigation Types
// ============================================================

export type CreatorStackParamList = {
  CreatorDashboard: undefined;
  MyNFTs: undefined;
  MintNFT: undefined;
  CreateCollection: undefined;
  NFTDetail: { nftId: string };
  CollectionDetail: { collectionId: string };
  Earnings: undefined;
  Transactions: undefined;
};

export type NotificationStackParamList = {
  Notifications: undefined;
  NotificationSettings: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Marketplace: undefined;
  Creator: undefined;
  Notifications: undefined;
  Profile: undefined;
};