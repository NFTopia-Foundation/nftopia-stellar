export interface SearchAttributeDocument {
  traitType: string;
  value: string;
  displayType?: string;
}

export interface SearchNftDocument {
  id: string;
  tokenId: string;
  contractAddress: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  animationUrl: string | null;
  externalUrl: string | null;
  ownerId: string;
  creatorId: string;
  collectionId: string | null;
  lastPrice: number | null;
  isBurned: boolean;
  mintedAt: string | null;
  createdAt: string;
  updatedAt: string;
  attributes: SearchAttributeDocument[];
  attributeFacets: string[];
  entityType: 'nft';
}

export interface SearchProfileDocument {
  id: string;
  address: string | null;
  username: string | null;
  bio: string | null;
  avatarUrl: string | null;
  walletAddress: string | null;
  walletPublicKey: string | null;
  walletProvider: string | null;
  entityType: 'profile';
}

export interface SearchResults<TDocument> {
  hits: TDocument[];
  estimatedTotalHits: number;
  page: number;
  hitsPerPage: number;
  totalPages: number;
  facetDistribution?: Record<string, Record<string, number>>;
}
