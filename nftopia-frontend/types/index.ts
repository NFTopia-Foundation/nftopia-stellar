export interface Collection {
  id: string;
  title: string;
  creatorName: string;
  creatorImage: string;
  images: {
    main: string;
    secondary1: string;
    secondary2: string;
  };
  likes: number;
  description?: string;
  totalVolume?: string;
  floorPrice?: string;
  totalSupply?: number;
  isVerified?: boolean;
}

// NEW: Types for likes
export interface CollectionLikesInfo {
  count: number;
  isLiked: boolean;
}

export interface LikeCollectionResult {
  success: boolean;
  collectionId: string;
  likesCount: number;
  userLiked: boolean;
  message?: string;
}

export interface UnlikeCollectionResult {
  success: boolean;
  collectionId: string;
  likesCount: number;
  userLiked: boolean;
  message?: string;
}

// NEW: NFT Types for My NFTs page
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
  mintedAt: Date;
  lastPrice: string | null;
  collectionName?: string;
}

export interface NFTPaginationResponse {
  items: NFT[];
  total: number;
  page: number;
  limit: number;
  hasNextPage: boolean;
}

export interface NFTQueryParams {
  ownerId: string;
  page?: number;
  limit?: number;
  search?: string;
  collectionId?: string;
  includeBurned?: boolean;
}