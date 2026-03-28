import type { Collection } from '../entities/collection.entity';

export type CollectionCursorPayload = {
  createdAt: string;
  id: string;
};

export type CollectionConnectionQuery = {
  first?: number;
  after?: CollectionCursorPayload;
  creatorId?: string;
  search?: string;
  verifiedOnly?: boolean;
};

export type CollectionConnectionResult<T = Collection> = {
  data: T[];
  total: number;
  hasNextPage: boolean;
};

export type CollectionStatsResult = {
  totalVolume: string;
  floorPrice: string;
  totalSupply: number;
  ownerCount: number;
};
