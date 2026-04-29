export interface NftAttributeInput {
  traitType: string;
  value: string;
  displayType?: string;
}

export interface NftQueryResult<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface NftConnectionCursor {
  createdAt: string;
  id: string;
}

export interface NftConnectionQuery {
  first: number;
  after?: NftConnectionCursor;
  ownerId?: string;
  creatorId?: string;
  collectionId?: string;
  search?: string;
  includeBurned?: boolean;
}

export interface NftConnectionResult<T> {
  data: T[];
  total: number;
  hasNextPage: boolean;
}

export interface StellarMintSyncResult {
  synced: boolean;
  ledger: number;
  tokenId: string;
  contractAddress: string;
}

export interface BurnNftResponse {
  id: string;
  isBurned: boolean;
  burnedAt: string;
}
