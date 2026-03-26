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
