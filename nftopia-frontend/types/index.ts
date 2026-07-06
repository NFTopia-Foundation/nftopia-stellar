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