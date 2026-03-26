export interface ICollection {
  id: string;
  contractAddress: string;
  name: string;
  symbol: string;
  description?: string;
  imageUrl?: string;
  bannerImageUrl?: string;
  creatorId: string;
  totalSupply: number;
  floorPrice?: string;
  totalVolume: string;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICollectionStats {
  totalSupply: number;
  floorPrice?: string;
  totalVolume: string;
  owners: number;
  listedCount: number;
}

export interface ICollectionQuery {
  page?: number;
  limit?: number;
  search?: string;
  creatorId?: string;
  isVerified?: boolean;
  sortBy?: 'createdAt' | 'totalVolume' | 'floorPrice' | 'name';
  sortOrder?: 'ASC' | 'DESC';
}
