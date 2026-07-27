// NFT Types
export interface NFTAttribute {
  traitType: string;
  value: string;
  displayType?: string;
}

export interface NFT {
  id: string;
  tokenId: string;
  contractAddress: string;
  name: string;
  description: string | null;
  image: string | null;
  attributes: NFTAttribute[];
  ownerId: string;
  creatorId: string;
  collectionId: string | null;
  mintedAt: string;
  lastPrice: string | null;
  collectionName?: string;
}

// Creator / User (simplified for marketplace)
export interface CreatorInfo {
  id: string;
  username: string | null;
  walletAddress: string;
  avatar: string | null;
}

// Marketplace Listing Types
export type ListingStatus = "ACTIVE" | "SOLD" | "CANCELLED" | "EXPIRED";

export interface Listing {
  id: string;
  nftId: string;
  sellerId: string;
  price: string;
  currency: string;
  status: ListingStatus;
  createdAt: string;
  expiresAt: string | null;
  nft?: NFT;
  seller?: CreatorInfo;
}

// Pagination Types
export interface PageInfo {
  hasNextPage: boolean;
  startCursor: string | null;
  endCursor: string | null;
}

export interface PaginationInput {
  first: number;
  after?: string | null;
}

export interface ListingConnection {
  edges: ListingEdge[];
  pageInfo: PageInfo;
  totalCount: number;
}

export interface ListingEdge {
  node: Listing;
  cursor: string;
}

// Marketplace Filter Types
export interface MarketplaceFilter {
  search: string;
  minPrice: number | null;
  maxPrice: number | null;
  status: ListingStatus | "ALL";
  sortBy: "NEWEST" | "PRICE_ASC" | "PRICE_DESC";
}

// Marketplace State Types
export interface MarketplaceState {
  listings: Listing[];
  pageInfo: PageInfo;
  totalCount: number;
  isLoading: boolean;
  isLoadingMore: boolean;
  isRefreshing: boolean;
  error: string | null;
  filter: MarketplaceFilter;
}

export const DEFAULT_FILTER: MarketplaceFilter = {
  search: "",
  minPrice: null,
  maxPrice: null,
  status: "ACTIVE",
  sortBy: "NEWEST",
};
