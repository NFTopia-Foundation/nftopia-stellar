import { gql } from '@apollo/client';
import * as Apollo from '@apollo/client';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
const defaultOptions = {} as const;
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  /** A date-time string at UTC, such as 2019-12-03T09:54:33Z, compliant with the date-time format. */
  DateTime: { input: any; output: any; }
  /** Arbitrary JSON value */
  JSON: { input: any; output: any; }
};

export type Auction = {
  __typename?: 'Auction';
  bids?: Maybe<Array<Bid>>;
  currentPrice: Scalars['String']['output'];
  endTime: Scalars['DateTime']['output'];
  highestBid?: Maybe<Bid>;
  id: Scalars['ID']['output'];
  nft?: Maybe<Nft>;
  nftId: Scalars['ID']['output'];
  reservePrice?: Maybe<Scalars['String']['output']>;
  seller?: Maybe<User>;
  sellerId: Scalars['ID']['output'];
  startPrice: Scalars['String']['output'];
  startTime: Scalars['DateTime']['output'];
  status: AuctionStatus;
  winner?: Maybe<User>;
  winnerId?: Maybe<Scalars['ID']['output']>;
};

export type AuctionConnection = {
  __typename?: 'AuctionConnection';
  edges: Array<AuctionEdge>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type AuctionEdge = {
  __typename?: 'AuctionEdge';
  cursor: Scalars['String']['output'];
  node: Auction;
};

/** Current state of an NFT auction */
export enum AuctionStatus {
  Active = 'ACTIVE',
  Cancelled = 'CANCELLED',
  Completed = 'COMPLETED',
  Settled = 'SETTLED'
}

export type Bid = {
  __typename?: 'Bid';
  amount: Scalars['String']['output'];
  auction?: Maybe<Auction>;
  auctionId: Scalars['ID']['output'];
  bidder?: Maybe<User>;
  bidderId: Scalars['ID']['output'];
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
};

export type Collection = {
  __typename?: 'Collection';
  contractAddress?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['DateTime']['output'];
  creator?: Maybe<User>;
  creatorId: Scalars['ID']['output'];
  description?: Maybe<Scalars['String']['output']>;
  floorPrice: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  image: Scalars['String']['output'];
  name: Scalars['String']['output'];
  /** NFTs that belong to this collection */
  nfts?: Maybe<NftConnection>;
  symbol: Scalars['String']['output'];
  totalSupply: Scalars['Int']['output'];
  totalVolume: Scalars['String']['output'];
};


export type CollectionNftsArgs = {
  filter?: InputMaybe<NftFilterInput>;
  pagination?: InputMaybe<PaginationInput>;
};

export type CollectionConnection = {
  __typename?: 'CollectionConnection';
  edges: Array<CollectionEdge>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type CollectionEdge = {
  __typename?: 'CollectionEdge';
  cursor: Scalars['String']['output'];
  node: Collection;
};

export type CollectionFilterInput = {
  creatorId?: InputMaybe<Scalars['ID']['input']>;
  search?: InputMaybe<Scalars['String']['input']>;
  verifiedOnly?: InputMaybe<Scalars['Boolean']['input']>;
};

export type CollectionStats = {
  __typename?: 'CollectionStats';
  floorPrice: Scalars['String']['output'];
  ownerCount: Scalars['Int']['output'];
  totalSupply: Scalars['Int']['output'];
  totalVolume: Scalars['String']['output'];
};

export type CreateBidInput = {
  amount: Scalars['Float']['input'];
  auctionId: Scalars['ID']['input'];
};

export type CreateCollectionInput = {
  bannerImage?: InputMaybe<Scalars['String']['input']>;
  contractAddress: Scalars['String']['input'];
  description?: InputMaybe<Scalars['String']['input']>;
  image: Scalars['String']['input'];
  name: Scalars['String']['input'];
  symbol: Scalars['String']['input'];
};

export type CreateListingInput = {
  currency?: InputMaybe<Scalars['String']['input']>;
  expiresAt?: InputMaybe<Scalars['String']['input']>;
  nftId: Scalars['ID']['input'];
  price: Scalars['Float']['input'];
};

export type CreatorActivityConnection = {
  __typename?: 'CreatorActivityConnection';
  edges: Array<CreatorActivityEdge>;
  totalCount: Scalars['Int']['output'];
};

export type CreatorActivityEdge = {
  __typename?: 'CreatorActivityEdge';
  cursor: Scalars['String']['output'];
  node: CreatorActivityItem;
};

export type CreatorActivityItem = {
  __typename?: 'CreatorActivityItem';
  currency?: Maybe<Scalars['String']['output']>;
  nftId?: Maybe<Scalars['ID']['output']>;
  occurredAt: Scalars['DateTime']['output'];
  price?: Maybe<Scalars['String']['output']>;
  type: CreatorActivityType;
};

export enum CreatorActivityType {
  Listing = 'LISTING',
  Mint = 'MINT',
  Sale = 'SALE'
}

export enum CreatorNftSort {
  Newest = 'NEWEST',
  Price = 'PRICE'
}

export type FollowResult = {
  __typename?: 'FollowResult';
  followerCount: Scalars['Int']['output'];
  isFollowing: Scalars['Boolean']['output'];
  success: Scalars['Boolean']['output'];
};

export type GraphqlHealthResponse = {
  __typename?: 'GraphqlHealthResponse';
  service: Scalars['String']['output'];
  status: Scalars['String']['output'];
  timestamp: Scalars['String']['output'];
};

export type Listing = {
  __typename?: 'Listing';
  createdAt: Scalars['DateTime']['output'];
  currency: Scalars['String']['output'];
  expiresAt?: Maybe<Scalars['DateTime']['output']>;
  id: Scalars['ID']['output'];
  nft?: Maybe<Nft>;
  nftId: Scalars['ID']['output'];
  price: Scalars['String']['output'];
  seller?: Maybe<User>;
  sellerId: Scalars['ID']['output'];
  status: ListingStatus;
};

export type ListingConnection = {
  __typename?: 'ListingConnection';
  edges: Array<ListingEdge>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type ListingEdge = {
  __typename?: 'ListingEdge';
  cursor: Scalars['String']['output'];
  node: Listing;
};

export type ListingFilterInput = {
  nftId?: InputMaybe<Scalars['ID']['input']>;
  sellerId?: InputMaybe<Scalars['ID']['input']>;
  status?: InputMaybe<ListingStatus>;
};

/** Current state of a marketplace listing */
export enum ListingStatus {
  Active = 'ACTIVE',
  Cancelled = 'CANCELLED',
  Expired = 'EXPIRED',
  Sold = 'SOLD'
}

export type MintNftInput = {
  animationUrl?: InputMaybe<Scalars['String']['input']>;
  attributes?: InputMaybe<Array<NftAttributeInput>>;
  collectionId?: InputMaybe<Scalars['ID']['input']>;
  contractAddress: Scalars['String']['input'];
  creatorId: Scalars['ID']['input'];
  description?: InputMaybe<Scalars['String']['input']>;
  externalUrl?: InputMaybe<Scalars['String']['input']>;
  image?: InputMaybe<Scalars['String']['input']>;
  lastPrice?: InputMaybe<Scalars['Float']['input']>;
  name: Scalars['String']['input'];
  ownerId: Scalars['ID']['input'];
  tokenId: Scalars['String']['input'];
};

export type Mutation = {
  __typename?: 'Mutation';
  /** Execute NFT purchase against an active listing */
  buyNFT: TransactionResult;
  /** Cancel an existing listing owned by the caller */
  cancelListing: Scalars['Boolean']['output'];
  /** Create a new collection */
  createCollection: Collection;
  /** Create a new marketplace listing */
  createListing: Listing;
  /** Follow a creator */
  followCreator: FollowResult;
  /** Mint a new NFT */
  mintNFT: Nft;
  /** Place a bid on an auction */
  placeBid: Bid;
  /** Unfollow a creator */
  unfollowCreator: FollowResult;
  /** Update NFT metadata */
  updateNFTMetadata: Nft;
};


export type MutationBuyNftArgs = {
  listingId: Scalars['ID']['input'];
};


export type MutationCancelListingArgs = {
  id: Scalars['ID']['input'];
};


export type MutationCreateCollectionArgs = {
  input: CreateCollectionInput;
};


export type MutationCreateListingArgs = {
  input: CreateListingInput;
};


export type MutationFollowCreatorArgs = {
  creatorId: Scalars['ID']['input'];
};


export type MutationMintNftArgs = {
  input: MintNftInput;
};


export type MutationPlaceBidArgs = {
  input: CreateBidInput;
};


export type MutationUnfollowCreatorArgs = {
  creatorId: Scalars['ID']['input'];
};


export type MutationUpdateNftMetadataArgs = {
  id: Scalars['ID']['input'];
  input: UpdateNftMetadataInput;
};

export type Nft = {
  __typename?: 'NFT';
  attributes: Array<NftAttribute>;
  auction?: Maybe<Auction>;
  collection?: Maybe<Collection>;
  collectionId?: Maybe<Scalars['ID']['output']>;
  contractAddress: Scalars['String']['output'];
  creator?: Maybe<User>;
  creatorId: Scalars['ID']['output'];
  currentAuction?: Maybe<Auction>;
  description?: Maybe<Scalars['String']['output']>;
  firstTransfer?: Maybe<TransferEvent>;
  id: Scalars['ID']['output'];
  image?: Maybe<Scalars['String']['output']>;
  lastPrice?: Maybe<Scalars['String']['output']>;
  lastTransfer?: Maybe<TransferEvent>;
  listing?: Maybe<Listing>;
  listings?: Maybe<Array<Listing>>;
  mintedAt: Scalars['DateTime']['output'];
  name: Scalars['String']['output'];
  orders?: Maybe<Array<Order>>;
  owner?: Maybe<User>;
  ownerId: Scalars['ID']['output'];
  tokenId: Scalars['String']['output'];
  transferHistory?: Maybe<TransferEventConnection>;
};


export type NftTransferHistoryArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  page?: InputMaybe<Scalars['Int']['input']>;
};

export type NftAttribute = {
  __typename?: 'NFTAttribute';
  displayType?: Maybe<Scalars['String']['output']>;
  traitType: Scalars['String']['output'];
  value: Scalars['String']['output'];
};

export type NftAttributeInput = {
  displayType?: InputMaybe<Scalars['String']['input']>;
  traitType: Scalars['String']['input'];
  value: Scalars['String']['input'];
};

export type NftConnection = {
  __typename?: 'NFTConnection';
  edges: Array<NftEdge>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type NftEdge = {
  __typename?: 'NFTEdge';
  cursor: Scalars['String']['output'];
  node: Nft;
};

export type NftFilterInput = {
  collectionId?: InputMaybe<Scalars['ID']['input']>;
  creatorId?: InputMaybe<Scalars['ID']['input']>;
  includeBurned?: InputMaybe<Scalars['Boolean']['input']>;
  ownerId?: InputMaybe<Scalars['ID']['input']>;
  search?: InputMaybe<Scalars['String']['input']>;
};

export type Order = {
  __typename?: 'Order';
  buyer?: Maybe<User>;
  buyerId: Scalars['ID']['output'];
  createdAt: Scalars['DateTime']['output'];
  currency: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  nft?: Maybe<Nft>;
  nftId: Scalars['ID']['output'];
  price: Scalars['String']['output'];
  seller?: Maybe<User>;
  sellerId: Scalars['ID']['output'];
  status: OrderStatus;
  transactionHash?: Maybe<Scalars['String']['output']>;
  type: OrderType;
};

export type OrderConnection = {
  __typename?: 'OrderConnection';
  edges: Array<OrderEdge>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type OrderEdge = {
  __typename?: 'OrderEdge';
  cursor: Scalars['String']['output'];
  node: Order;
};

/** Status of the order */
export enum OrderStatus {
  Completed = 'COMPLETED',
  Failed = 'FAILED',
  Pending = 'PENDING'
}

/** Type of order: SALE or PURCHASE */
export enum OrderType {
  Purchase = 'PURCHASE',
  Sale = 'SALE'
}

export type PageInfo = {
  __typename?: 'PageInfo';
  endCursor?: Maybe<Scalars['String']['output']>;
  hasNextPage: Scalars['Boolean']['output'];
  startCursor?: Maybe<Scalars['String']['output']>;
};

export type PaginationInput = {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
};

export type PublicCreator = {
  __typename?: 'PublicCreator';
  activity?: Maybe<CreatorActivityConnection>;
  avatarUrl?: Maybe<Scalars['String']['output']>;
  bannerUrl?: Maybe<Scalars['String']['output']>;
  bio?: Maybe<Scalars['String']['output']>;
  collections?: Maybe<CollectionConnection>;
  createdAt: Scalars['DateTime']['output'];
  followerCount: Scalars['Int']['output'];
  followingCount: Scalars['Int']['output'];
  id: Scalars['ID']['output'];
  instagramHandle?: Maybe<Scalars['String']['output']>;
  isFollowing?: Maybe<Scalars['Boolean']['output']>;
  isVerified: Scalars['Boolean']['output'];
  nfts?: Maybe<NftConnection>;
  totalNftsCreated: Scalars['Int']['output'];
  totalSalesVolume: Scalars['String']['output'];
  twitterHandle?: Maybe<Scalars['String']['output']>;
  username?: Maybe<Scalars['String']['output']>;
  website?: Maybe<Scalars['String']['output']>;
};


export type PublicCreatorActivityArgs = {
  pagination?: InputMaybe<PaginationInput>;
};


export type PublicCreatorCollectionsArgs = {
  pagination?: InputMaybe<PaginationInput>;
};


export type PublicCreatorNftsArgs = {
  pagination?: InputMaybe<PaginationInput>;
  sortBy?: InputMaybe<CreatorNftSort>;
};

export type Query = {
  __typename?: 'Query';
  /** Fetch a single auction by ID */
  auction: Auction;
  /** Fetch a single collection by ID */
  collection: Collection;
  /** Fetch aggregated statistics for a collection */
  collectionStats: CollectionStats;
  /** Fetch collections with cursor pagination and optional filters */
  collections: CollectionConnection;
  /** GraphQL gateway health check */
  health: GraphqlHealthResponse;
  /** Fetch a single listing by ID */
  listing: Listing;
  /** Fetch listings with cursor pagination and optional filters */
  listings: ListingConnection;
  /** Fetch the currently authenticated user */
  me: User;
  /** Fetch current user's orders (authenticated) */
  myOrders: OrderConnection;
  /** Fetch a single NFT by ID */
  nft: Nft;
  /** Fetch order history for NFT */
  nftOrders: Array<Order>;
  /** Fetch a specific transfer event by ID */
  nftTransferEvent?: Maybe<TransferEvent>;
  /** Fetch NFT transfer history with pagination (page-based) */
  nftTransferHistory: TransferEventConnection;
  /** Fetch NFT transfer history with cursor-based pagination */
  nftTransferHistoryCursor: TransferEventConnection;
  /** Fetch NFTs with cursor pagination and optional filters */
  nfts: NftConnection;
  /** Fetch NFTs owned by a specific user */
  nftsByOwner: NftConnection;
  /** Fetch single order by ID */
  order: Order;
  /** Fetch a public creator profile by id, username, or wallet address */
  publicCreator: PublicCreator;
  /** Fetch sales analytics (admin only) */
  salesAnalytics: SalesAnalytics;
  /** Fetch top collections ordered by total volume */
  topCollections: Array<Collection>;
  /** Fetch a single user by ID */
  user: User;
  /** Fetch a user by Stellar address */
  userByAddress?: Maybe<User>;
  /** Fetch orders for specific user */
  userOrders: OrderConnection;
};


export type QueryAuctionArgs = {
  id: Scalars['ID']['input'];
};


export type QueryCollectionArgs = {
  id: Scalars['ID']['input'];
};


export type QueryCollectionStatsArgs = {
  collectionId: Scalars['ID']['input'];
};


export type QueryCollectionsArgs = {
  filter?: InputMaybe<CollectionFilterInput>;
  pagination?: InputMaybe<PaginationInput>;
};


export type QueryListingArgs = {
  id: Scalars['ID']['input'];
};


export type QueryListingsArgs = {
  filter?: InputMaybe<ListingFilterInput>;
  pagination?: InputMaybe<PaginationInput>;
};


export type QueryMyOrdersArgs = {
  pagination?: InputMaybe<PaginationInput>;
  type?: InputMaybe<Scalars['String']['input']>;
};


export type QueryNftArgs = {
  id: Scalars['ID']['input'];
};


export type QueryNftOrdersArgs = {
  nftId: Scalars['ID']['input'];
};


export type QueryNftTransferEventArgs = {
  id: Scalars['ID']['input'];
};


export type QueryNftTransferHistoryArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  nftId: Scalars['ID']['input'];
  page?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryNftTransferHistoryCursorArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  nftId: Scalars['ID']['input'];
};


export type QueryNftsArgs = {
  filter?: InputMaybe<NftFilterInput>;
  pagination?: InputMaybe<PaginationInput>;
};


export type QueryNftsByOwnerArgs = {
  ownerId: Scalars['ID']['input'];
  pagination?: InputMaybe<PaginationInput>;
};


export type QueryOrderArgs = {
  id: Scalars['ID']['input'];
};


export type QueryPublicCreatorArgs = {
  identifier: Scalars['String']['input'];
};


export type QuerySalesAnalyticsArgs = {
  timeframe: TimeframeInput;
};


export type QueryTopCollectionsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryUserArgs = {
  id: Scalars['ID']['input'];
};


export type QueryUserByAddressArgs = {
  address: Scalars['String']['input'];
};


export type QueryUserOrdersArgs = {
  pagination?: InputMaybe<PaginationInput>;
  userId: Scalars['ID']['input'];
};

export type SalesAnalytics = {
  __typename?: 'SalesAnalytics';
  averagePrice: Scalars['String']['output'];
  periodEnd: Scalars['DateTime']['output'];
  periodStart: Scalars['DateTime']['output'];
  totalSales: Scalars['Int']['output'];
  totalVolume: Scalars['String']['output'];
};

export type TimeframeInput = {
  periodEnd: Scalars['String']['input'];
  periodStart: Scalars['String']['input'];
};

export type TransactionResult = {
  __typename?: 'TransactionResult';
  buyerId?: Maybe<Scalars['ID']['output']>;
  listingId: Scalars['ID']['output'];
  success: Scalars['Boolean']['output'];
};

export type TransferEvent = {
  __typename?: 'TransferEvent';
  blockExplorerUrl?: Maybe<Scalars['String']['output']>;
  currency?: Maybe<Scalars['String']['output']>;
  eventType: Scalars['String']['output'];
  fromAddress: Scalars['String']['output'];
  fromAddressTruncated?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  price?: Maybe<Scalars['String']['output']>;
  timestamp: Scalars['DateTime']['output'];
  toAddress: Scalars['String']['output'];
  toAddressTruncated?: Maybe<Scalars['String']['output']>;
  transactionHash: Scalars['String']['output'];
};

export type TransferEventConnection = {
  __typename?: 'TransferEventConnection';
  edges: Array<TransferEventEdge>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type TransferEventEdge = {
  __typename?: 'TransferEventEdge';
  cursor: Scalars['String']['output'];
  node: TransferEvent;
};

export type UpdateNftMetadataInput = {
  animationUrl?: InputMaybe<Scalars['String']['input']>;
  attributes?: InputMaybe<Array<NftAttributeInput>>;
  collectionId?: InputMaybe<Scalars['ID']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  externalUrl?: InputMaybe<Scalars['String']['input']>;
  image?: InputMaybe<Scalars['String']['input']>;
  lastPrice?: InputMaybe<Scalars['Float']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
};

export type User = {
  __typename?: 'User';
  auctions?: Maybe<AuctionConnection>;
  avatar?: Maybe<Scalars['String']['output']>;
  email?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  listings?: Maybe<ListingConnection>;
  nfts?: Maybe<NftConnection>;
  ownedNFTs?: Maybe<NftConnection>;
  purchases?: Maybe<OrderConnection>;
  sales?: Maybe<OrderConnection>;
  stellarAddress?: Maybe<Scalars['String']['output']>;
  username?: Maybe<Scalars['String']['output']>;
  walletAddress?: Maybe<Scalars['String']['output']>;
};


export type UserAuctionsArgs = {
  pagination?: InputMaybe<PaginationInput>;
};


export type UserListingsArgs = {
  pagination?: InputMaybe<PaginationInput>;
};


export type UserNftsArgs = {
  pagination?: InputMaybe<PaginationInput>;
};


export type UserOwnedNfTsArgs = {
  pagination?: InputMaybe<PaginationInput>;
};


export type UserPurchasesArgs = {
  pagination?: InputMaybe<PaginationInput>;
};


export type UserSalesArgs = {
  pagination?: InputMaybe<PaginationInput>;
};

export type UserFieldsFragment = { __typename?: 'User', id: string, walletAddress?: string | null, username?: string | null, avatar?: string | null };

export type CollectionFieldsFragment = { __typename?: 'Collection', id: string, name: string, description?: string | null, image: string, creatorId: string, createdAt: any };

export type NftFieldsFragment = { __typename?: 'NFT', id: string, tokenId: string, name: string, description?: string | null, image?: string | null, ownerId: string, collectionId?: string | null, mintedAt: any };

export type ListingFieldsFragment = { __typename?: 'Listing', id: string, nftId: string, sellerId: string, price: string, currency: string, status: ListingStatus, createdAt: any, expiresAt?: any | null };

export type AuctionFieldsFragment = { __typename?: 'Auction', id: string, nftId: string, sellerId: string, startPrice: string, currentPrice: string, reservePrice?: string | null, startTime: any, endTime: any, status: AuctionStatus, winnerId?: string | null };

export type TransferEventFieldsFragment = { __typename?: 'TransferEvent', id: string, fromAddress: string, toAddress: string, transactionHash: string, eventType: string, price?: string | null, currency?: string | null, timestamp: any, fromAddressTruncated?: string | null, toAddressTruncated?: string | null, blockExplorerUrl?: string | null };

export type GetAuctionByIdQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type GetAuctionByIdQuery = { __typename?: 'Query', auction: { __typename?: 'Auction', id: string, nftId: string, sellerId: string, startPrice: string, currentPrice: string, reservePrice?: string | null, startTime: any, endTime: any, status: AuctionStatus, winnerId?: string | null, nft?: { __typename?: 'NFT', id: string, name: string, image?: string | null, tokenId: string, description?: string | null, attributes: Array<{ __typename?: 'NFTAttribute', traitType: string, value: string, displayType?: string | null }>, collection?: { __typename?: 'Collection', id: string, name: string, symbol: string, image: string } | null, creator?: { __typename?: 'User', id: string, username?: string | null, walletAddress?: string | null } | null, owner?: { __typename?: 'User', id: string, username?: string | null, walletAddress?: string | null } | null } | null, bids?: Array<{ __typename?: 'Bid', id: string, amount: string, bidderId: string, createdAt: any, bidder?: { __typename?: 'User', id: string, username?: string | null, walletAddress?: string | null } | null }> | null, highestBid?: { __typename?: 'Bid', id: string, amount: string, bidderId: string, createdAt: any, bidder?: { __typename?: 'User', id: string, username?: string | null } | null } | null, seller?: { __typename?: 'User', id: string, username?: string | null, walletAddress?: string | null } | null, winner?: { __typename?: 'User', id: string, username?: string | null, walletAddress?: string | null } | null } };

export type PlaceBidMutationVariables = Exact<{
  input: CreateBidInput;
}>;


export type PlaceBidMutation = { __typename?: 'Mutation', placeBid: { __typename?: 'Bid', id: string, auctionId: string, bidderId: string, amount: string, createdAt: any, bidder?: { __typename?: 'User', id: string, username?: string | null, walletAddress?: string | null } | null } };

export type GetCollectionsQueryVariables = Exact<{
  pagination?: InputMaybe<PaginationInput>;
  filter?: InputMaybe<CollectionFilterInput>;
}>;


export type GetCollectionsQuery = { __typename?: 'Query', collections: { __typename?: 'CollectionConnection', totalCount: number, edges: Array<{ __typename?: 'CollectionEdge', cursor: string, node: { __typename?: 'Collection', id: string, name: string, description?: string | null, image: string, creatorId: string, createdAt: any } }>, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, startCursor?: string | null, endCursor?: string | null } } };

export type GetCollectionByIdQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type GetCollectionByIdQuery = { __typename?: 'Query', collection: { __typename?: 'Collection', totalVolume: string, floorPrice: string, totalSupply: number, id: string, name: string, description?: string | null, image: string, creatorId: string, createdAt: any, creator?: { __typename?: 'User', id: string, username?: string | null, walletAddress?: string | null } | null, nfts?: { __typename?: 'NFTConnection', totalCount: number, edges: Array<{ __typename?: 'NFTEdge', cursor: string, node: { __typename?: 'NFT', id: string, name: string, image?: string | null, tokenId: string, lastPrice?: string | null } }>, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, startCursor?: string | null, endCursor?: string | null } } | null } };

export type GetTopCollectionsQueryVariables = Exact<{
  limit?: InputMaybe<Scalars['Int']['input']>;
}>;


export type GetTopCollectionsQuery = { __typename?: 'Query', topCollections: Array<{ __typename?: 'Collection', totalVolume: string, floorPrice: string, totalSupply: number, id: string, name: string, description?: string | null, image: string, creatorId: string, createdAt: any }> };

export type GetCollectionStatsQueryVariables = Exact<{
  collectionId: Scalars['ID']['input'];
}>;


export type GetCollectionStatsQuery = { __typename?: 'Query', collectionStats: { __typename?: 'CollectionStats', totalVolume: string, floorPrice: string, totalSupply: number, ownerCount: number } };

export type PublicCreatorFieldsFragment = { __typename?: 'PublicCreator', id: string, username?: string | null, bio?: string | null, avatarUrl?: string | null, bannerUrl?: string | null, website?: string | null, twitterHandle?: string | null, instagramHandle?: string | null, isVerified: boolean, followerCount: number, followingCount: number, totalNftsCreated: number, totalSalesVolume: string, createdAt: any, isFollowing?: boolean | null };

export type GetPublicCreatorQueryVariables = Exact<{
  identifier: Scalars['String']['input'];
  nftFirst?: InputMaybe<Scalars['Int']['input']>;
  nftAfter?: InputMaybe<Scalars['String']['input']>;
  nftSort?: InputMaybe<CreatorNftSort>;
  collectionFirst?: InputMaybe<Scalars['Int']['input']>;
  collectionAfter?: InputMaybe<Scalars['String']['input']>;
  activityFirst?: InputMaybe<Scalars['Int']['input']>;
  activityAfter?: InputMaybe<Scalars['String']['input']>;
}>;


export type GetPublicCreatorQuery = { __typename?: 'Query', publicCreator: { __typename?: 'PublicCreator', id: string, username?: string | null, bio?: string | null, avatarUrl?: string | null, bannerUrl?: string | null, website?: string | null, twitterHandle?: string | null, instagramHandle?: string | null, isVerified: boolean, followerCount: number, followingCount: number, totalNftsCreated: number, totalSalesVolume: string, createdAt: any, isFollowing?: boolean | null, nfts?: { __typename?: 'NFTConnection', totalCount: number, edges: Array<{ __typename?: 'NFTEdge', cursor: string, node: { __typename?: 'NFT', lastPrice?: string | null, id: string, tokenId: string, name: string, description?: string | null, image?: string | null, ownerId: string, collectionId?: string | null, mintedAt: any } }>, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, endCursor?: string | null } } | null, collections?: { __typename?: 'CollectionConnection', totalCount: number, edges: Array<{ __typename?: 'CollectionEdge', cursor: string, node: { __typename?: 'Collection', floorPrice: string, totalSupply: number, id: string, name: string, description?: string | null, image: string, creatorId: string, createdAt: any } }>, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, endCursor?: string | null } } | null, activity?: { __typename?: 'CreatorActivityConnection', totalCount: number, edges: Array<{ __typename?: 'CreatorActivityEdge', cursor: string, node: { __typename?: 'CreatorActivityItem', type: CreatorActivityType, occurredAt: any, nftId?: string | null, price?: string | null, currency?: string | null } }> } | null } };

export type GetPublicCreatorMetaQueryVariables = Exact<{
  identifier: Scalars['String']['input'];
}>;


export type GetPublicCreatorMetaQuery = { __typename?: 'Query', publicCreator: { __typename?: 'PublicCreator', id: string, username?: string | null, bio?: string | null, avatarUrl?: string | null, bannerUrl?: string | null } };

export type FollowCreatorMutationVariables = Exact<{
  creatorId: Scalars['ID']['input'];
}>;


export type FollowCreatorMutation = { __typename?: 'Mutation', followCreator: { __typename?: 'FollowResult', success: boolean, followerCount: number, isFollowing: boolean } };

export type UnfollowCreatorMutationVariables = Exact<{
  creatorId: Scalars['ID']['input'];
}>;


export type UnfollowCreatorMutation = { __typename?: 'Mutation', unfollowCreator: { __typename?: 'FollowResult', success: boolean, followerCount: number, isFollowing: boolean } };

export type GetListingsQueryVariables = Exact<{
  pagination?: InputMaybe<PaginationInput>;
  filter?: InputMaybe<ListingFilterInput>;
}>;


export type GetListingsQuery = { __typename?: 'Query', listings: { __typename?: 'ListingConnection', totalCount: number, edges: Array<{ __typename?: 'ListingEdge', cursor: string, node: { __typename?: 'Listing', id: string, nftId: string, sellerId: string, price: string, currency: string, status: ListingStatus, createdAt: any, expiresAt?: any | null, nft?: { __typename?: 'NFT', id: string, name: string, image?: string | null, tokenId: string } | null, seller?: { __typename?: 'User', id: string, username?: string | null, walletAddress?: string | null } | null } }>, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, startCursor?: string | null, endCursor?: string | null } } };

export type GetListingByIdQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type GetListingByIdQuery = { __typename?: 'Query', listing: { __typename?: 'Listing', id: string, nftId: string, sellerId: string, price: string, currency: string, status: ListingStatus, createdAt: any, expiresAt?: any | null, nft?: { __typename?: 'NFT', id: string, name: string, description?: string | null, image?: string | null, tokenId: string, ownerId: string, creatorId: string, lastPrice?: string | null } | null, seller?: { __typename?: 'User', id: string, username?: string | null, walletAddress?: string | null } | null } };

export type CreateListingMutationVariables = Exact<{
  input: CreateListingInput;
}>;


export type CreateListingMutation = { __typename?: 'Mutation', createListing: { __typename?: 'Listing', id: string, nftId: string, sellerId: string, price: string, currency: string, status: ListingStatus, createdAt: any, expiresAt?: any | null, nft?: { __typename?: 'NFT', id: string, name: string, image?: string | null } | null } };

export type CancelListingMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type CancelListingMutation = { __typename?: 'Mutation', cancelListing: boolean };

export type BuyNftMutationVariables = Exact<{
  listingId: Scalars['ID']['input'];
}>;


export type BuyNftMutation = { __typename?: 'Mutation', buyNFT: { __typename?: 'TransactionResult', success: boolean, listingId: string, buyerId?: string | null } };

export type GatewayHealthQueryVariables = Exact<{ [key: string]: never; }>;


export type GatewayHealthQuery = { __typename?: 'Query', health: { __typename?: 'GraphqlHealthResponse', status: string, service: string, timestamp: string } };

export type GetNftsQueryVariables = Exact<{
  pagination?: InputMaybe<PaginationInput>;
  filter?: InputMaybe<NftFilterInput>;
}>;


export type GetNftsQuery = { __typename?: 'Query', nfts: { __typename?: 'NFTConnection', totalCount: number, edges: Array<{ __typename?: 'NFTEdge', cursor: string, node: { __typename?: 'NFT', id: string, tokenId: string, name: string, description?: string | null, image?: string | null, ownerId: string, collectionId?: string | null, mintedAt: any } }>, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, startCursor?: string | null, endCursor?: string | null } } };

export type GetNftByIdQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type GetNftByIdQuery = { __typename?: 'Query', nft: { __typename?: 'NFT', contractAddress: string, mintedAt: any, lastPrice?: string | null, id: string, tokenId: string, name: string, description?: string | null, image?: string | null, ownerId: string, collectionId?: string | null, attributes: Array<{ __typename?: 'NFTAttribute', traitType: string, value: string, displayType?: string | null }>, creator?: { __typename?: 'User', id: string, username?: string | null, walletAddress?: string | null } | null, owner?: { __typename?: 'User', id: string, username?: string | null, walletAddress?: string | null } | null, collection?: { __typename?: 'Collection', id: string, name: string, symbol: string, image: string } | null } };

export type GetNftTransferHistoryQueryVariables = Exact<{
  nftId: Scalars['ID']['input'];
  page?: InputMaybe<Scalars['Int']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
}>;


export type GetNftTransferHistoryQuery = { __typename?: 'Query', nftTransferHistory: { __typename?: 'TransferEventConnection', totalCount: number, edges: Array<{ __typename?: 'TransferEventEdge', cursor: string, node: { __typename?: 'TransferEvent', id: string, fromAddress: string, toAddress: string, transactionHash: string, eventType: string, price?: string | null, currency?: string | null, timestamp: any, fromAddressTruncated?: string | null, toAddressTruncated?: string | null, blockExplorerUrl?: string | null } }>, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, startCursor?: string | null, endCursor?: string | null } } };

export type GetNftTransferHistoryCursorQueryVariables = Exact<{
  nftId: Scalars['ID']['input'];
  first?: InputMaybe<Scalars['Int']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
}>;


export type GetNftTransferHistoryCursorQuery = { __typename?: 'Query', nftTransferHistoryCursor: { __typename?: 'TransferEventConnection', totalCount: number, edges: Array<{ __typename?: 'TransferEventEdge', cursor: string, node: { __typename?: 'TransferEvent', id: string, fromAddress: string, toAddress: string, transactionHash: string, eventType: string, price?: string | null, currency?: string | null, timestamp: any, fromAddressTruncated?: string | null, toAddressTruncated?: string | null, blockExplorerUrl?: string | null } }>, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, startCursor?: string | null, endCursor?: string | null } } };

export type GetNftTransferEventQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type GetNftTransferEventQuery = { __typename?: 'Query', nftTransferEvent?: { __typename?: 'TransferEvent', id: string, fromAddress: string, toAddress: string, transactionHash: string, eventType: string, price?: string | null, currency?: string | null, timestamp: any, fromAddressTruncated?: string | null, toAddressTruncated?: string | null, blockExplorerUrl?: string | null } | null };

export type GetCurrentUserQueryVariables = Exact<{ [key: string]: never; }>;


export type GetCurrentUserQuery = { __typename?: 'Query', me: { __typename?: 'User', id: string, walletAddress?: string | null, username?: string | null, avatar?: string | null, nfts?: { __typename?: 'NFTConnection', totalCount: number, edges: Array<{ __typename?: 'NFTEdge', cursor: string, node: { __typename?: 'NFT', id: string, name: string, image?: string | null, tokenId: string, lastPrice?: string | null } }>, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, startCursor?: string | null, endCursor?: string | null } } | null, ownedNFTs?: { __typename?: 'NFTConnection', totalCount: number, edges: Array<{ __typename?: 'NFTEdge', cursor: string, node: { __typename?: 'NFT', id: string, name: string, image?: string | null, tokenId: string, lastPrice?: string | null } }>, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, startCursor?: string | null, endCursor?: string | null } } | null, listings?: { __typename?: 'ListingConnection', totalCount: number, edges: Array<{ __typename?: 'ListingEdge', cursor: string, node: { __typename?: 'Listing', id: string, nftId: string, price: string, currency: string, status: ListingStatus, createdAt: any } }>, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, startCursor?: string | null, endCursor?: string | null } } | null, auctions?: { __typename?: 'AuctionConnection', totalCount: number, edges: Array<{ __typename?: 'AuctionEdge', cursor: string, node: { __typename?: 'Auction', id: string, nftId: string, currentPrice: string, status: AuctionStatus, endTime: any } }>, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, startCursor?: string | null, endCursor?: string | null } } | null, purchases?: { __typename?: 'OrderConnection', totalCount: number, edges: Array<{ __typename?: 'OrderEdge', cursor: string, node: { __typename?: 'Order', id: string, nftId: string, price: string, currency: string, status: OrderStatus, createdAt: any } }>, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, startCursor?: string | null, endCursor?: string | null } } | null, sales?: { __typename?: 'OrderConnection', totalCount: number, edges: Array<{ __typename?: 'OrderEdge', cursor: string, node: { __typename?: 'Order', id: string, nftId: string, price: string, currency: string, status: OrderStatus, createdAt: any } }>, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, startCursor?: string | null, endCursor?: string | null } } | null } };

export type GetUserByIdQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type GetUserByIdQuery = { __typename?: 'Query', user: { __typename?: 'User', id: string, walletAddress?: string | null, username?: string | null, avatar?: string | null, nfts?: { __typename?: 'NFTConnection', totalCount: number, edges: Array<{ __typename?: 'NFTEdge', cursor: string, node: { __typename?: 'NFT', id: string, name: string, image?: string | null, tokenId: string, lastPrice?: string | null } }>, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, startCursor?: string | null, endCursor?: string | null } } | null, ownedNFTs?: { __typename?: 'NFTConnection', totalCount: number, edges: Array<{ __typename?: 'NFTEdge', cursor: string, node: { __typename?: 'NFT', id: string, name: string, image?: string | null, tokenId: string, lastPrice?: string | null } }>, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, startCursor?: string | null, endCursor?: string | null } } | null, listings?: { __typename?: 'ListingConnection', totalCount: number, edges: Array<{ __typename?: 'ListingEdge', cursor: string, node: { __typename?: 'Listing', id: string, nftId: string, price: string, currency: string, status: ListingStatus, createdAt: any } }>, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, startCursor?: string | null, endCursor?: string | null } } | null, purchases?: { __typename?: 'OrderConnection', totalCount: number, edges: Array<{ __typename?: 'OrderEdge', cursor: string, node: { __typename?: 'Order', id: string, nftId: string, price: string, currency: string, status: OrderStatus, createdAt: any } }>, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, startCursor?: string | null, endCursor?: string | null } } | null, sales?: { __typename?: 'OrderConnection', totalCount: number, edges: Array<{ __typename?: 'OrderEdge', cursor: string, node: { __typename?: 'Order', id: string, nftId: string, price: string, currency: string, status: OrderStatus, createdAt: any } }>, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, startCursor?: string | null, endCursor?: string | null } } | null } };

export type GetUserByAddressQueryVariables = Exact<{
  address: Scalars['String']['input'];
}>;


export type GetUserByAddressQuery = { __typename?: 'Query', userByAddress?: { __typename?: 'User', id: string, walletAddress?: string | null, username?: string | null, avatar?: string | null, nfts?: { __typename?: 'NFTConnection', totalCount: number, edges: Array<{ __typename?: 'NFTEdge', cursor: string, node: { __typename?: 'NFT', id: string, name: string, image?: string | null, tokenId: string } }>, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, startCursor?: string | null, endCursor?: string | null } } | null } | null };

export const UserFieldsFragmentDoc = gql`
    fragment UserFields on User {
  id
  walletAddress
  username
  avatar
}
    `;
export const CollectionFieldsFragmentDoc = gql`
    fragment CollectionFields on Collection {
  id
  name
  description
  image
  creatorId
  createdAt
}
    `;
export const NftFieldsFragmentDoc = gql`
    fragment NftFields on NFT {
  id
  tokenId
  name
  description
  image
  ownerId
  collectionId
  mintedAt
}
    `;
export const ListingFieldsFragmentDoc = gql`
    fragment ListingFields on Listing {
  id
  nftId
  sellerId
  price
  currency
  status
  createdAt
  expiresAt
}
    `;
export const AuctionFieldsFragmentDoc = gql`
    fragment AuctionFields on Auction {
  id
  nftId
  sellerId
  startPrice
  currentPrice
  reservePrice
  startTime
  endTime
  status
  winnerId
}
    `;
export const TransferEventFieldsFragmentDoc = gql`
    fragment TransferEventFields on TransferEvent {
  id
  fromAddress
  toAddress
  transactionHash
  eventType
  price
  currency
  timestamp
  fromAddressTruncated
  toAddressTruncated
  blockExplorerUrl
}
    `;
export const PublicCreatorFieldsFragmentDoc = gql`
    fragment PublicCreatorFields on PublicCreator {
  id
  username
  bio
  avatarUrl
  bannerUrl
  website
  twitterHandle
  instagramHandle
  isVerified
  followerCount
  followingCount
  totalNftsCreated
  totalSalesVolume
  createdAt
  isFollowing
}
    `;
export const GetAuctionByIdDocument = gql`
    query GetAuctionById($id: ID!) {
  auction(id: $id) {
    ...AuctionFields
    nft {
      id
      name
      image
      tokenId
      description
      attributes {
        traitType
        value
        displayType
      }
      collection {
        id
        name
        symbol
        image
      }
      creator {
        id
        username
        walletAddress
      }
      owner {
        id
        username
        walletAddress
      }
    }
    bids {
      id
      amount
      bidderId
      bidder {
        id
        username
        walletAddress
      }
      createdAt
    }
    highestBid {
      id
      amount
      bidderId
      bidder {
        id
        username
      }
      createdAt
    }
    seller {
      id
      username
      walletAddress
    }
    winner {
      id
      username
      walletAddress
    }
  }
}
    ${AuctionFieldsFragmentDoc}`;

/**
 * __useGetAuctionByIdQuery__
 *
 * To run a query within a React component, call `useGetAuctionByIdQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetAuctionByIdQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetAuctionByIdQuery({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useGetAuctionByIdQuery(baseOptions: Apollo.QueryHookOptions<GetAuctionByIdQuery, GetAuctionByIdQueryVariables> & ({ variables: GetAuctionByIdQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetAuctionByIdQuery, GetAuctionByIdQueryVariables>(GetAuctionByIdDocument, options);
      }
export function useGetAuctionByIdLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetAuctionByIdQuery, GetAuctionByIdQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetAuctionByIdQuery, GetAuctionByIdQueryVariables>(GetAuctionByIdDocument, options);
        }
// @ts-ignore
export function useGetAuctionByIdSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<GetAuctionByIdQuery, GetAuctionByIdQueryVariables>): Apollo.UseSuspenseQueryResult<GetAuctionByIdQuery, GetAuctionByIdQueryVariables>;
export function useGetAuctionByIdSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetAuctionByIdQuery, GetAuctionByIdQueryVariables>): Apollo.UseSuspenseQueryResult<GetAuctionByIdQuery | undefined, GetAuctionByIdQueryVariables>;
export function useGetAuctionByIdSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetAuctionByIdQuery, GetAuctionByIdQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<GetAuctionByIdQuery, GetAuctionByIdQueryVariables>(GetAuctionByIdDocument, options);
        }
export type GetAuctionByIdQueryHookResult = ReturnType<typeof useGetAuctionByIdQuery>;
export type GetAuctionByIdLazyQueryHookResult = ReturnType<typeof useGetAuctionByIdLazyQuery>;
export type GetAuctionByIdSuspenseQueryHookResult = ReturnType<typeof useGetAuctionByIdSuspenseQuery>;
export type GetAuctionByIdQueryResult = Apollo.QueryResult<GetAuctionByIdQuery, GetAuctionByIdQueryVariables>;
export const PlaceBidDocument = gql`
    mutation PlaceBid($input: CreateBidInput!) {
  placeBid(input: $input) {
    id
    auctionId
    bidderId
    amount
    createdAt
    bidder {
      id
      username
      walletAddress
    }
  }
}
    `;
export type PlaceBidMutationFn = Apollo.MutationFunction<PlaceBidMutation, PlaceBidMutationVariables>;

/**
 * __usePlaceBidMutation__
 *
 * To run a mutation, you first call `usePlaceBidMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `usePlaceBidMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [placeBidMutation, { data, loading, error }] = usePlaceBidMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function usePlaceBidMutation(baseOptions?: Apollo.MutationHookOptions<PlaceBidMutation, PlaceBidMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<PlaceBidMutation, PlaceBidMutationVariables>(PlaceBidDocument, options);
      }
export type PlaceBidMutationHookResult = ReturnType<typeof usePlaceBidMutation>;
export type PlaceBidMutationResult = Apollo.MutationResult<PlaceBidMutation>;
export type PlaceBidMutationOptions = Apollo.BaseMutationOptions<PlaceBidMutation, PlaceBidMutationVariables>;
export const GetCollectionsDocument = gql`
    query GetCollections($pagination: PaginationInput, $filter: CollectionFilterInput) {
  collections(pagination: $pagination, filter: $filter) {
    edges {
      node {
        ...CollectionFields
      }
      cursor
    }
    pageInfo {
      hasNextPage
      startCursor
      endCursor
    }
    totalCount
  }
}
    ${CollectionFieldsFragmentDoc}`;

/**
 * __useGetCollectionsQuery__
 *
 * To run a query within a React component, call `useGetCollectionsQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetCollectionsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetCollectionsQuery({
 *   variables: {
 *      pagination: // value for 'pagination'
 *      filter: // value for 'filter'
 *   },
 * });
 */
export function useGetCollectionsQuery(baseOptions?: Apollo.QueryHookOptions<GetCollectionsQuery, GetCollectionsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetCollectionsQuery, GetCollectionsQueryVariables>(GetCollectionsDocument, options);
      }
export function useGetCollectionsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetCollectionsQuery, GetCollectionsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetCollectionsQuery, GetCollectionsQueryVariables>(GetCollectionsDocument, options);
        }
// @ts-ignore
export function useGetCollectionsSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<GetCollectionsQuery, GetCollectionsQueryVariables>): Apollo.UseSuspenseQueryResult<GetCollectionsQuery, GetCollectionsQueryVariables>;
export function useGetCollectionsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetCollectionsQuery, GetCollectionsQueryVariables>): Apollo.UseSuspenseQueryResult<GetCollectionsQuery | undefined, GetCollectionsQueryVariables>;
export function useGetCollectionsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetCollectionsQuery, GetCollectionsQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<GetCollectionsQuery, GetCollectionsQueryVariables>(GetCollectionsDocument, options);
        }
export type GetCollectionsQueryHookResult = ReturnType<typeof useGetCollectionsQuery>;
export type GetCollectionsLazyQueryHookResult = ReturnType<typeof useGetCollectionsLazyQuery>;
export type GetCollectionsSuspenseQueryHookResult = ReturnType<typeof useGetCollectionsSuspenseQuery>;
export type GetCollectionsQueryResult = Apollo.QueryResult<GetCollectionsQuery, GetCollectionsQueryVariables>;
export const GetCollectionByIdDocument = gql`
    query GetCollectionById($id: ID!) {
  collection(id: $id) {
    ...CollectionFields
    totalVolume
    floorPrice
    totalSupply
    creator {
      id
      username
      walletAddress
    }
    nfts(pagination: {first: 20}) {
      edges {
        node {
          id
          name
          image
          tokenId
          lastPrice
        }
        cursor
      }
      pageInfo {
        hasNextPage
        startCursor
        endCursor
      }
      totalCount
    }
  }
}
    ${CollectionFieldsFragmentDoc}`;

/**
 * __useGetCollectionByIdQuery__
 *
 * To run a query within a React component, call `useGetCollectionByIdQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetCollectionByIdQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetCollectionByIdQuery({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useGetCollectionByIdQuery(baseOptions: Apollo.QueryHookOptions<GetCollectionByIdQuery, GetCollectionByIdQueryVariables> & ({ variables: GetCollectionByIdQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetCollectionByIdQuery, GetCollectionByIdQueryVariables>(GetCollectionByIdDocument, options);
      }
export function useGetCollectionByIdLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetCollectionByIdQuery, GetCollectionByIdQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetCollectionByIdQuery, GetCollectionByIdQueryVariables>(GetCollectionByIdDocument, options);
        }
// @ts-ignore
export function useGetCollectionByIdSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<GetCollectionByIdQuery, GetCollectionByIdQueryVariables>): Apollo.UseSuspenseQueryResult<GetCollectionByIdQuery, GetCollectionByIdQueryVariables>;
export function useGetCollectionByIdSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetCollectionByIdQuery, GetCollectionByIdQueryVariables>): Apollo.UseSuspenseQueryResult<GetCollectionByIdQuery | undefined, GetCollectionByIdQueryVariables>;
export function useGetCollectionByIdSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetCollectionByIdQuery, GetCollectionByIdQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<GetCollectionByIdQuery, GetCollectionByIdQueryVariables>(GetCollectionByIdDocument, options);
        }
export type GetCollectionByIdQueryHookResult = ReturnType<typeof useGetCollectionByIdQuery>;
export type GetCollectionByIdLazyQueryHookResult = ReturnType<typeof useGetCollectionByIdLazyQuery>;
export type GetCollectionByIdSuspenseQueryHookResult = ReturnType<typeof useGetCollectionByIdSuspenseQuery>;
export type GetCollectionByIdQueryResult = Apollo.QueryResult<GetCollectionByIdQuery, GetCollectionByIdQueryVariables>;
export const GetTopCollectionsDocument = gql`
    query GetTopCollections($limit: Int) {
  topCollections(limit: $limit) {
    ...CollectionFields
    totalVolume
    floorPrice
    totalSupply
  }
}
    ${CollectionFieldsFragmentDoc}`;

/**
 * __useGetTopCollectionsQuery__
 *
 * To run a query within a React component, call `useGetTopCollectionsQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetTopCollectionsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetTopCollectionsQuery({
 *   variables: {
 *      limit: // value for 'limit'
 *   },
 * });
 */
export function useGetTopCollectionsQuery(baseOptions?: Apollo.QueryHookOptions<GetTopCollectionsQuery, GetTopCollectionsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetTopCollectionsQuery, GetTopCollectionsQueryVariables>(GetTopCollectionsDocument, options);
      }
export function useGetTopCollectionsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetTopCollectionsQuery, GetTopCollectionsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetTopCollectionsQuery, GetTopCollectionsQueryVariables>(GetTopCollectionsDocument, options);
        }
// @ts-ignore
export function useGetTopCollectionsSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<GetTopCollectionsQuery, GetTopCollectionsQueryVariables>): Apollo.UseSuspenseQueryResult<GetTopCollectionsQuery, GetTopCollectionsQueryVariables>;
export function useGetTopCollectionsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetTopCollectionsQuery, GetTopCollectionsQueryVariables>): Apollo.UseSuspenseQueryResult<GetTopCollectionsQuery | undefined, GetTopCollectionsQueryVariables>;
export function useGetTopCollectionsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetTopCollectionsQuery, GetTopCollectionsQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<GetTopCollectionsQuery, GetTopCollectionsQueryVariables>(GetTopCollectionsDocument, options);
        }
export type GetTopCollectionsQueryHookResult = ReturnType<typeof useGetTopCollectionsQuery>;
export type GetTopCollectionsLazyQueryHookResult = ReturnType<typeof useGetTopCollectionsLazyQuery>;
export type GetTopCollectionsSuspenseQueryHookResult = ReturnType<typeof useGetTopCollectionsSuspenseQuery>;
export type GetTopCollectionsQueryResult = Apollo.QueryResult<GetTopCollectionsQuery, GetTopCollectionsQueryVariables>;
export const GetCollectionStatsDocument = gql`
    query GetCollectionStats($collectionId: ID!) {
  collectionStats(collectionId: $collectionId) {
    totalVolume
    floorPrice
    totalSupply
    ownerCount
  }
}
    `;

/**
 * __useGetCollectionStatsQuery__
 *
 * To run a query within a React component, call `useGetCollectionStatsQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetCollectionStatsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetCollectionStatsQuery({
 *   variables: {
 *      collectionId: // value for 'collectionId'
 *   },
 * });
 */
export function useGetCollectionStatsQuery(baseOptions: Apollo.QueryHookOptions<GetCollectionStatsQuery, GetCollectionStatsQueryVariables> & ({ variables: GetCollectionStatsQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetCollectionStatsQuery, GetCollectionStatsQueryVariables>(GetCollectionStatsDocument, options);
      }
export function useGetCollectionStatsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetCollectionStatsQuery, GetCollectionStatsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetCollectionStatsQuery, GetCollectionStatsQueryVariables>(GetCollectionStatsDocument, options);
        }
// @ts-ignore
export function useGetCollectionStatsSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<GetCollectionStatsQuery, GetCollectionStatsQueryVariables>): Apollo.UseSuspenseQueryResult<GetCollectionStatsQuery, GetCollectionStatsQueryVariables>;
export function useGetCollectionStatsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetCollectionStatsQuery, GetCollectionStatsQueryVariables>): Apollo.UseSuspenseQueryResult<GetCollectionStatsQuery | undefined, GetCollectionStatsQueryVariables>;
export function useGetCollectionStatsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetCollectionStatsQuery, GetCollectionStatsQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<GetCollectionStatsQuery, GetCollectionStatsQueryVariables>(GetCollectionStatsDocument, options);
        }
export type GetCollectionStatsQueryHookResult = ReturnType<typeof useGetCollectionStatsQuery>;
export type GetCollectionStatsLazyQueryHookResult = ReturnType<typeof useGetCollectionStatsLazyQuery>;
export type GetCollectionStatsSuspenseQueryHookResult = ReturnType<typeof useGetCollectionStatsSuspenseQuery>;
export type GetCollectionStatsQueryResult = Apollo.QueryResult<GetCollectionStatsQuery, GetCollectionStatsQueryVariables>;
export const GetPublicCreatorDocument = gql`
    query GetPublicCreator($identifier: String!, $nftFirst: Int = 12, $nftAfter: String, $nftSort: CreatorNftSort, $collectionFirst: Int = 12, $collectionAfter: String, $activityFirst: Int = 10, $activityAfter: String) {
  publicCreator(identifier: $identifier) {
    ...PublicCreatorFields
    nfts(pagination: {first: $nftFirst, after: $nftAfter}, sortBy: $nftSort) {
      edges {
        node {
          ...NftFields
          lastPrice
        }
        cursor
      }
      pageInfo {
        hasNextPage
        endCursor
      }
      totalCount
    }
    collections(pagination: {first: $collectionFirst, after: $collectionAfter}) {
      edges {
        node {
          ...CollectionFields
          floorPrice
          totalSupply
        }
        cursor
      }
      pageInfo {
        hasNextPage
        endCursor
      }
      totalCount
    }
    activity(pagination: {first: $activityFirst, after: $activityAfter}) {
      edges {
        node {
          type
          occurredAt
          nftId
          price
          currency
        }
        cursor
      }
      totalCount
    }
  }
}
    ${PublicCreatorFieldsFragmentDoc}
${NftFieldsFragmentDoc}
${CollectionFieldsFragmentDoc}`;

/**
 * __useGetPublicCreatorQuery__
 *
 * To run a query within a React component, call `useGetPublicCreatorQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetPublicCreatorQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetPublicCreatorQuery({
 *   variables: {
 *      identifier: // value for 'identifier'
 *      nftFirst: // value for 'nftFirst'
 *      nftAfter: // value for 'nftAfter'
 *      nftSort: // value for 'nftSort'
 *      collectionFirst: // value for 'collectionFirst'
 *      collectionAfter: // value for 'collectionAfter'
 *      activityFirst: // value for 'activityFirst'
 *      activityAfter: // value for 'activityAfter'
 *   },
 * });
 */
export function useGetPublicCreatorQuery(baseOptions: Apollo.QueryHookOptions<GetPublicCreatorQuery, GetPublicCreatorQueryVariables> & ({ variables: GetPublicCreatorQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetPublicCreatorQuery, GetPublicCreatorQueryVariables>(GetPublicCreatorDocument, options);
      }
export function useGetPublicCreatorLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetPublicCreatorQuery, GetPublicCreatorQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetPublicCreatorQuery, GetPublicCreatorQueryVariables>(GetPublicCreatorDocument, options);
        }
// @ts-ignore
export function useGetPublicCreatorSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<GetPublicCreatorQuery, GetPublicCreatorQueryVariables>): Apollo.UseSuspenseQueryResult<GetPublicCreatorQuery, GetPublicCreatorQueryVariables>;
export function useGetPublicCreatorSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetPublicCreatorQuery, GetPublicCreatorQueryVariables>): Apollo.UseSuspenseQueryResult<GetPublicCreatorQuery | undefined, GetPublicCreatorQueryVariables>;
export function useGetPublicCreatorSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetPublicCreatorQuery, GetPublicCreatorQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<GetPublicCreatorQuery, GetPublicCreatorQueryVariables>(GetPublicCreatorDocument, options);
        }
export type GetPublicCreatorQueryHookResult = ReturnType<typeof useGetPublicCreatorQuery>;
export type GetPublicCreatorLazyQueryHookResult = ReturnType<typeof useGetPublicCreatorLazyQuery>;
export type GetPublicCreatorSuspenseQueryHookResult = ReturnType<typeof useGetPublicCreatorSuspenseQuery>;
export type GetPublicCreatorQueryResult = Apollo.QueryResult<GetPublicCreatorQuery, GetPublicCreatorQueryVariables>;
export const GetPublicCreatorMetaDocument = gql`
    query GetPublicCreatorMeta($identifier: String!) {
  publicCreator(identifier: $identifier) {
    id
    username
    bio
    avatarUrl
    bannerUrl
  }
}
    `;

/**
 * __useGetPublicCreatorMetaQuery__
 *
 * To run a query within a React component, call `useGetPublicCreatorMetaQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetPublicCreatorMetaQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetPublicCreatorMetaQuery({
 *   variables: {
 *      identifier: // value for 'identifier'
 *   },
 * });
 */
export function useGetPublicCreatorMetaQuery(baseOptions: Apollo.QueryHookOptions<GetPublicCreatorMetaQuery, GetPublicCreatorMetaQueryVariables> & ({ variables: GetPublicCreatorMetaQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetPublicCreatorMetaQuery, GetPublicCreatorMetaQueryVariables>(GetPublicCreatorMetaDocument, options);
      }
export function useGetPublicCreatorMetaLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetPublicCreatorMetaQuery, GetPublicCreatorMetaQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetPublicCreatorMetaQuery, GetPublicCreatorMetaQueryVariables>(GetPublicCreatorMetaDocument, options);
        }
// @ts-ignore
export function useGetPublicCreatorMetaSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<GetPublicCreatorMetaQuery, GetPublicCreatorMetaQueryVariables>): Apollo.UseSuspenseQueryResult<GetPublicCreatorMetaQuery, GetPublicCreatorMetaQueryVariables>;
export function useGetPublicCreatorMetaSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetPublicCreatorMetaQuery, GetPublicCreatorMetaQueryVariables>): Apollo.UseSuspenseQueryResult<GetPublicCreatorMetaQuery | undefined, GetPublicCreatorMetaQueryVariables>;
export function useGetPublicCreatorMetaSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetPublicCreatorMetaQuery, GetPublicCreatorMetaQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<GetPublicCreatorMetaQuery, GetPublicCreatorMetaQueryVariables>(GetPublicCreatorMetaDocument, options);
        }
export type GetPublicCreatorMetaQueryHookResult = ReturnType<typeof useGetPublicCreatorMetaQuery>;
export type GetPublicCreatorMetaLazyQueryHookResult = ReturnType<typeof useGetPublicCreatorMetaLazyQuery>;
export type GetPublicCreatorMetaSuspenseQueryHookResult = ReturnType<typeof useGetPublicCreatorMetaSuspenseQuery>;
export type GetPublicCreatorMetaQueryResult = Apollo.QueryResult<GetPublicCreatorMetaQuery, GetPublicCreatorMetaQueryVariables>;
export const FollowCreatorDocument = gql`
    mutation FollowCreator($creatorId: ID!) {
  followCreator(creatorId: $creatorId) {
    success
    followerCount
    isFollowing
  }
}
    `;
export type FollowCreatorMutationFn = Apollo.MutationFunction<FollowCreatorMutation, FollowCreatorMutationVariables>;

/**
 * __useFollowCreatorMutation__
 *
 * To run a mutation, you first call `useFollowCreatorMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useFollowCreatorMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [followCreatorMutation, { data, loading, error }] = useFollowCreatorMutation({
 *   variables: {
 *      creatorId: // value for 'creatorId'
 *   },
 * });
 */
export function useFollowCreatorMutation(baseOptions?: Apollo.MutationHookOptions<FollowCreatorMutation, FollowCreatorMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<FollowCreatorMutation, FollowCreatorMutationVariables>(FollowCreatorDocument, options);
      }
export type FollowCreatorMutationHookResult = ReturnType<typeof useFollowCreatorMutation>;
export type FollowCreatorMutationResult = Apollo.MutationResult<FollowCreatorMutation>;
export type FollowCreatorMutationOptions = Apollo.BaseMutationOptions<FollowCreatorMutation, FollowCreatorMutationVariables>;
export const UnfollowCreatorDocument = gql`
    mutation UnfollowCreator($creatorId: ID!) {
  unfollowCreator(creatorId: $creatorId) {
    success
    followerCount
    isFollowing
  }
}
    `;
export type UnfollowCreatorMutationFn = Apollo.MutationFunction<UnfollowCreatorMutation, UnfollowCreatorMutationVariables>;

/**
 * __useUnfollowCreatorMutation__
 *
 * To run a mutation, you first call `useUnfollowCreatorMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useUnfollowCreatorMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [unfollowCreatorMutation, { data, loading, error }] = useUnfollowCreatorMutation({
 *   variables: {
 *      creatorId: // value for 'creatorId'
 *   },
 * });
 */
export function useUnfollowCreatorMutation(baseOptions?: Apollo.MutationHookOptions<UnfollowCreatorMutation, UnfollowCreatorMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UnfollowCreatorMutation, UnfollowCreatorMutationVariables>(UnfollowCreatorDocument, options);
      }
export type UnfollowCreatorMutationHookResult = ReturnType<typeof useUnfollowCreatorMutation>;
export type UnfollowCreatorMutationResult = Apollo.MutationResult<UnfollowCreatorMutation>;
export type UnfollowCreatorMutationOptions = Apollo.BaseMutationOptions<UnfollowCreatorMutation, UnfollowCreatorMutationVariables>;
export const GetListingsDocument = gql`
    query GetListings($pagination: PaginationInput, $filter: ListingFilterInput) {
  listings(pagination: $pagination, filter: $filter) {
    edges {
      node {
        ...ListingFields
        nft {
          id
          name
          image
          tokenId
        }
        seller {
          id
          username
          walletAddress
        }
      }
      cursor
    }
    pageInfo {
      hasNextPage
      startCursor
      endCursor
    }
    totalCount
  }
}
    ${ListingFieldsFragmentDoc}`;

/**
 * __useGetListingsQuery__
 *
 * To run a query within a React component, call `useGetListingsQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetListingsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetListingsQuery({
 *   variables: {
 *      pagination: // value for 'pagination'
 *      filter: // value for 'filter'
 *   },
 * });
 */
export function useGetListingsQuery(baseOptions?: Apollo.QueryHookOptions<GetListingsQuery, GetListingsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetListingsQuery, GetListingsQueryVariables>(GetListingsDocument, options);
      }
export function useGetListingsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetListingsQuery, GetListingsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetListingsQuery, GetListingsQueryVariables>(GetListingsDocument, options);
        }
// @ts-ignore
export function useGetListingsSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<GetListingsQuery, GetListingsQueryVariables>): Apollo.UseSuspenseQueryResult<GetListingsQuery, GetListingsQueryVariables>;
export function useGetListingsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetListingsQuery, GetListingsQueryVariables>): Apollo.UseSuspenseQueryResult<GetListingsQuery | undefined, GetListingsQueryVariables>;
export function useGetListingsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetListingsQuery, GetListingsQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<GetListingsQuery, GetListingsQueryVariables>(GetListingsDocument, options);
        }
export type GetListingsQueryHookResult = ReturnType<typeof useGetListingsQuery>;
export type GetListingsLazyQueryHookResult = ReturnType<typeof useGetListingsLazyQuery>;
export type GetListingsSuspenseQueryHookResult = ReturnType<typeof useGetListingsSuspenseQuery>;
export type GetListingsQueryResult = Apollo.QueryResult<GetListingsQuery, GetListingsQueryVariables>;
export const GetListingByIdDocument = gql`
    query GetListingById($id: ID!) {
  listing(id: $id) {
    ...ListingFields
    nft {
      id
      name
      description
      image
      tokenId
      ownerId
      creatorId
      lastPrice
    }
    seller {
      id
      username
      walletAddress
    }
  }
}
    ${ListingFieldsFragmentDoc}`;

/**
 * __useGetListingByIdQuery__
 *
 * To run a query within a React component, call `useGetListingByIdQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetListingByIdQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetListingByIdQuery({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useGetListingByIdQuery(baseOptions: Apollo.QueryHookOptions<GetListingByIdQuery, GetListingByIdQueryVariables> & ({ variables: GetListingByIdQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetListingByIdQuery, GetListingByIdQueryVariables>(GetListingByIdDocument, options);
      }
export function useGetListingByIdLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetListingByIdQuery, GetListingByIdQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetListingByIdQuery, GetListingByIdQueryVariables>(GetListingByIdDocument, options);
        }
// @ts-ignore
export function useGetListingByIdSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<GetListingByIdQuery, GetListingByIdQueryVariables>): Apollo.UseSuspenseQueryResult<GetListingByIdQuery, GetListingByIdQueryVariables>;
export function useGetListingByIdSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetListingByIdQuery, GetListingByIdQueryVariables>): Apollo.UseSuspenseQueryResult<GetListingByIdQuery | undefined, GetListingByIdQueryVariables>;
export function useGetListingByIdSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetListingByIdQuery, GetListingByIdQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<GetListingByIdQuery, GetListingByIdQueryVariables>(GetListingByIdDocument, options);
        }
export type GetListingByIdQueryHookResult = ReturnType<typeof useGetListingByIdQuery>;
export type GetListingByIdLazyQueryHookResult = ReturnType<typeof useGetListingByIdLazyQuery>;
export type GetListingByIdSuspenseQueryHookResult = ReturnType<typeof useGetListingByIdSuspenseQuery>;
export type GetListingByIdQueryResult = Apollo.QueryResult<GetListingByIdQuery, GetListingByIdQueryVariables>;
export const CreateListingDocument = gql`
    mutation CreateListing($input: CreateListingInput!) {
  createListing(input: $input) {
    ...ListingFields
    nft {
      id
      name
      image
    }
  }
}
    ${ListingFieldsFragmentDoc}`;
export type CreateListingMutationFn = Apollo.MutationFunction<CreateListingMutation, CreateListingMutationVariables>;

/**
 * __useCreateListingMutation__
 *
 * To run a mutation, you first call `useCreateListingMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useCreateListingMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [createListingMutation, { data, loading, error }] = useCreateListingMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useCreateListingMutation(baseOptions?: Apollo.MutationHookOptions<CreateListingMutation, CreateListingMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<CreateListingMutation, CreateListingMutationVariables>(CreateListingDocument, options);
      }
export type CreateListingMutationHookResult = ReturnType<typeof useCreateListingMutation>;
export type CreateListingMutationResult = Apollo.MutationResult<CreateListingMutation>;
export type CreateListingMutationOptions = Apollo.BaseMutationOptions<CreateListingMutation, CreateListingMutationVariables>;
export const CancelListingDocument = gql`
    mutation CancelListing($id: ID!) {
  cancelListing(id: $id)
}
    `;
export type CancelListingMutationFn = Apollo.MutationFunction<CancelListingMutation, CancelListingMutationVariables>;

/**
 * __useCancelListingMutation__
 *
 * To run a mutation, you first call `useCancelListingMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useCancelListingMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [cancelListingMutation, { data, loading, error }] = useCancelListingMutation({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useCancelListingMutation(baseOptions?: Apollo.MutationHookOptions<CancelListingMutation, CancelListingMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<CancelListingMutation, CancelListingMutationVariables>(CancelListingDocument, options);
      }
export type CancelListingMutationHookResult = ReturnType<typeof useCancelListingMutation>;
export type CancelListingMutationResult = Apollo.MutationResult<CancelListingMutation>;
export type CancelListingMutationOptions = Apollo.BaseMutationOptions<CancelListingMutation, CancelListingMutationVariables>;
export const BuyNftDocument = gql`
    mutation BuyNFT($listingId: ID!) {
  buyNFT(listingId: $listingId) {
    success
    listingId
    buyerId
  }
}
    `;
export type BuyNftMutationFn = Apollo.MutationFunction<BuyNftMutation, BuyNftMutationVariables>;

/**
 * __useBuyNftMutation__
 *
 * To run a mutation, you first call `useBuyNftMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useBuyNftMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [buyNftMutation, { data, loading, error }] = useBuyNftMutation({
 *   variables: {
 *      listingId: // value for 'listingId'
 *   },
 * });
 */
export function useBuyNftMutation(baseOptions?: Apollo.MutationHookOptions<BuyNftMutation, BuyNftMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<BuyNftMutation, BuyNftMutationVariables>(BuyNftDocument, options);
      }
export type BuyNftMutationHookResult = ReturnType<typeof useBuyNftMutation>;
export type BuyNftMutationResult = Apollo.MutationResult<BuyNftMutation>;
export type BuyNftMutationOptions = Apollo.BaseMutationOptions<BuyNftMutation, BuyNftMutationVariables>;
export const GatewayHealthDocument = gql`
    query GatewayHealth {
  health {
    status
    service
    timestamp
  }
}
    `;

/**
 * __useGatewayHealthQuery__
 *
 * To run a query within a React component, call `useGatewayHealthQuery` and pass it any options that fit your needs.
 * When your component renders, `useGatewayHealthQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGatewayHealthQuery({
 *   variables: {
 *   },
 * });
 */
export function useGatewayHealthQuery(baseOptions?: Apollo.QueryHookOptions<GatewayHealthQuery, GatewayHealthQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GatewayHealthQuery, GatewayHealthQueryVariables>(GatewayHealthDocument, options);
      }
export function useGatewayHealthLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GatewayHealthQuery, GatewayHealthQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GatewayHealthQuery, GatewayHealthQueryVariables>(GatewayHealthDocument, options);
        }
// @ts-ignore
export function useGatewayHealthSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<GatewayHealthQuery, GatewayHealthQueryVariables>): Apollo.UseSuspenseQueryResult<GatewayHealthQuery, GatewayHealthQueryVariables>;
export function useGatewayHealthSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GatewayHealthQuery, GatewayHealthQueryVariables>): Apollo.UseSuspenseQueryResult<GatewayHealthQuery | undefined, GatewayHealthQueryVariables>;
export function useGatewayHealthSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GatewayHealthQuery, GatewayHealthQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<GatewayHealthQuery, GatewayHealthQueryVariables>(GatewayHealthDocument, options);
        }
export type GatewayHealthQueryHookResult = ReturnType<typeof useGatewayHealthQuery>;
export type GatewayHealthLazyQueryHookResult = ReturnType<typeof useGatewayHealthLazyQuery>;
export type GatewayHealthSuspenseQueryHookResult = ReturnType<typeof useGatewayHealthSuspenseQuery>;
export type GatewayHealthQueryResult = Apollo.QueryResult<GatewayHealthQuery, GatewayHealthQueryVariables>;
export const GetNftsDocument = gql`
    query GetNfts($pagination: PaginationInput, $filter: NFTFilterInput) {
  nfts(pagination: $pagination, filter: $filter) {
    edges {
      node {
        ...NftFields
      }
      cursor
    }
    pageInfo {
      hasNextPage
      startCursor
      endCursor
    }
    totalCount
  }
}
    ${NftFieldsFragmentDoc}`;

/**
 * __useGetNftsQuery__
 *
 * To run a query within a React component, call `useGetNftsQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetNftsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetNftsQuery({
 *   variables: {
 *      pagination: // value for 'pagination'
 *      filter: // value for 'filter'
 *   },
 * });
 */
export function useGetNftsQuery(baseOptions?: Apollo.QueryHookOptions<GetNftsQuery, GetNftsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetNftsQuery, GetNftsQueryVariables>(GetNftsDocument, options);
      }
export function useGetNftsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetNftsQuery, GetNftsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetNftsQuery, GetNftsQueryVariables>(GetNftsDocument, options);
        }
// @ts-ignore
export function useGetNftsSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<GetNftsQuery, GetNftsQueryVariables>): Apollo.UseSuspenseQueryResult<GetNftsQuery, GetNftsQueryVariables>;
export function useGetNftsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetNftsQuery, GetNftsQueryVariables>): Apollo.UseSuspenseQueryResult<GetNftsQuery | undefined, GetNftsQueryVariables>;
export function useGetNftsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetNftsQuery, GetNftsQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<GetNftsQuery, GetNftsQueryVariables>(GetNftsDocument, options);
        }
export type GetNftsQueryHookResult = ReturnType<typeof useGetNftsQuery>;
export type GetNftsLazyQueryHookResult = ReturnType<typeof useGetNftsLazyQuery>;
export type GetNftsSuspenseQueryHookResult = ReturnType<typeof useGetNftsSuspenseQuery>;
export type GetNftsQueryResult = Apollo.QueryResult<GetNftsQuery, GetNftsQueryVariables>;
export const GetNftByIdDocument = gql`
    query GetNftById($id: ID!) {
  nft(id: $id) {
    ...NftFields
    contractAddress
    mintedAt
    lastPrice
    attributes {
      traitType
      value
      displayType
    }
    creator {
      id
      username
      walletAddress
    }
    owner {
      id
      username
      walletAddress
    }
    collection {
      id
      name
      symbol
      image
    }
  }
}
    ${NftFieldsFragmentDoc}`;

/**
 * __useGetNftByIdQuery__
 *
 * To run a query within a React component, call `useGetNftByIdQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetNftByIdQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetNftByIdQuery({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useGetNftByIdQuery(baseOptions: Apollo.QueryHookOptions<GetNftByIdQuery, GetNftByIdQueryVariables> & ({ variables: GetNftByIdQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetNftByIdQuery, GetNftByIdQueryVariables>(GetNftByIdDocument, options);
      }
export function useGetNftByIdLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetNftByIdQuery, GetNftByIdQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetNftByIdQuery, GetNftByIdQueryVariables>(GetNftByIdDocument, options);
        }
// @ts-ignore
export function useGetNftByIdSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<GetNftByIdQuery, GetNftByIdQueryVariables>): Apollo.UseSuspenseQueryResult<GetNftByIdQuery, GetNftByIdQueryVariables>;
export function useGetNftByIdSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetNftByIdQuery, GetNftByIdQueryVariables>): Apollo.UseSuspenseQueryResult<GetNftByIdQuery | undefined, GetNftByIdQueryVariables>;
export function useGetNftByIdSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetNftByIdQuery, GetNftByIdQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<GetNftByIdQuery, GetNftByIdQueryVariables>(GetNftByIdDocument, options);
        }
export type GetNftByIdQueryHookResult = ReturnType<typeof useGetNftByIdQuery>;
export type GetNftByIdLazyQueryHookResult = ReturnType<typeof useGetNftByIdLazyQuery>;
export type GetNftByIdSuspenseQueryHookResult = ReturnType<typeof useGetNftByIdSuspenseQuery>;
export type GetNftByIdQueryResult = Apollo.QueryResult<GetNftByIdQuery, GetNftByIdQueryVariables>;
export const GetNftTransferHistoryDocument = gql`
    query GetNftTransferHistory($nftId: ID!, $page: Int, $limit: Int) {
  nftTransferHistory(nftId: $nftId, page: $page, limit: $limit) {
    edges {
      node {
        ...TransferEventFields
      }
      cursor
    }
    pageInfo {
      hasNextPage
      startCursor
      endCursor
    }
    totalCount
  }
}
    ${TransferEventFieldsFragmentDoc}`;

/**
 * __useGetNftTransferHistoryQuery__
 *
 * To run a query within a React component, call `useGetNftTransferHistoryQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetNftTransferHistoryQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetNftTransferHistoryQuery({
 *   variables: {
 *      nftId: // value for 'nftId'
 *      page: // value for 'page'
 *      limit: // value for 'limit'
 *   },
 * });
 */
export function useGetNftTransferHistoryQuery(baseOptions: Apollo.QueryHookOptions<GetNftTransferHistoryQuery, GetNftTransferHistoryQueryVariables> & ({ variables: GetNftTransferHistoryQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetNftTransferHistoryQuery, GetNftTransferHistoryQueryVariables>(GetNftTransferHistoryDocument, options);
      }
export function useGetNftTransferHistoryLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetNftTransferHistoryQuery, GetNftTransferHistoryQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetNftTransferHistoryQuery, GetNftTransferHistoryQueryVariables>(GetNftTransferHistoryDocument, options);
        }
// @ts-ignore
export function useGetNftTransferHistorySuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<GetNftTransferHistoryQuery, GetNftTransferHistoryQueryVariables>): Apollo.UseSuspenseQueryResult<GetNftTransferHistoryQuery, GetNftTransferHistoryQueryVariables>;
export function useGetNftTransferHistorySuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetNftTransferHistoryQuery, GetNftTransferHistoryQueryVariables>): Apollo.UseSuspenseQueryResult<GetNftTransferHistoryQuery | undefined, GetNftTransferHistoryQueryVariables>;
export function useGetNftTransferHistorySuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetNftTransferHistoryQuery, GetNftTransferHistoryQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<GetNftTransferHistoryQuery, GetNftTransferHistoryQueryVariables>(GetNftTransferHistoryDocument, options);
        }
export type GetNftTransferHistoryQueryHookResult = ReturnType<typeof useGetNftTransferHistoryQuery>;
export type GetNftTransferHistoryLazyQueryHookResult = ReturnType<typeof useGetNftTransferHistoryLazyQuery>;
export type GetNftTransferHistorySuspenseQueryHookResult = ReturnType<typeof useGetNftTransferHistorySuspenseQuery>;
export type GetNftTransferHistoryQueryResult = Apollo.QueryResult<GetNftTransferHistoryQuery, GetNftTransferHistoryQueryVariables>;
export const GetNftTransferHistoryCursorDocument = gql`
    query GetNftTransferHistoryCursor($nftId: ID!, $first: Int, $after: String) {
  nftTransferHistoryCursor(nftId: $nftId, first: $first, after: $after) {
    edges {
      node {
        ...TransferEventFields
      }
      cursor
    }
    pageInfo {
      hasNextPage
      startCursor
      endCursor
    }
    totalCount
  }
}
    ${TransferEventFieldsFragmentDoc}`;

/**
 * __useGetNftTransferHistoryCursorQuery__
 *
 * To run a query within a React component, call `useGetNftTransferHistoryCursorQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetNftTransferHistoryCursorQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetNftTransferHistoryCursorQuery({
 *   variables: {
 *      nftId: // value for 'nftId'
 *      first: // value for 'first'
 *      after: // value for 'after'
 *   },
 * });
 */
export function useGetNftTransferHistoryCursorQuery(baseOptions: Apollo.QueryHookOptions<GetNftTransferHistoryCursorQuery, GetNftTransferHistoryCursorQueryVariables> & ({ variables: GetNftTransferHistoryCursorQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetNftTransferHistoryCursorQuery, GetNftTransferHistoryCursorQueryVariables>(GetNftTransferHistoryCursorDocument, options);
      }
export function useGetNftTransferHistoryCursorLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetNftTransferHistoryCursorQuery, GetNftTransferHistoryCursorQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetNftTransferHistoryCursorQuery, GetNftTransferHistoryCursorQueryVariables>(GetNftTransferHistoryCursorDocument, options);
        }
// @ts-ignore
export function useGetNftTransferHistoryCursorSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<GetNftTransferHistoryCursorQuery, GetNftTransferHistoryCursorQueryVariables>): Apollo.UseSuspenseQueryResult<GetNftTransferHistoryCursorQuery, GetNftTransferHistoryCursorQueryVariables>;
export function useGetNftTransferHistoryCursorSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetNftTransferHistoryCursorQuery, GetNftTransferHistoryCursorQueryVariables>): Apollo.UseSuspenseQueryResult<GetNftTransferHistoryCursorQuery | undefined, GetNftTransferHistoryCursorQueryVariables>;
export function useGetNftTransferHistoryCursorSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetNftTransferHistoryCursorQuery, GetNftTransferHistoryCursorQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<GetNftTransferHistoryCursorQuery, GetNftTransferHistoryCursorQueryVariables>(GetNftTransferHistoryCursorDocument, options);
        }
export type GetNftTransferHistoryCursorQueryHookResult = ReturnType<typeof useGetNftTransferHistoryCursorQuery>;
export type GetNftTransferHistoryCursorLazyQueryHookResult = ReturnType<typeof useGetNftTransferHistoryCursorLazyQuery>;
export type GetNftTransferHistoryCursorSuspenseQueryHookResult = ReturnType<typeof useGetNftTransferHistoryCursorSuspenseQuery>;
export type GetNftTransferHistoryCursorQueryResult = Apollo.QueryResult<GetNftTransferHistoryCursorQuery, GetNftTransferHistoryCursorQueryVariables>;
export const GetNftTransferEventDocument = gql`
    query GetNftTransferEvent($id: ID!) {
  nftTransferEvent(id: $id) {
    ...TransferEventFields
  }
}
    ${TransferEventFieldsFragmentDoc}`;

/**
 * __useGetNftTransferEventQuery__
 *
 * To run a query within a React component, call `useGetNftTransferEventQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetNftTransferEventQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetNftTransferEventQuery({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useGetNftTransferEventQuery(baseOptions: Apollo.QueryHookOptions<GetNftTransferEventQuery, GetNftTransferEventQueryVariables> & ({ variables: GetNftTransferEventQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetNftTransferEventQuery, GetNftTransferEventQueryVariables>(GetNftTransferEventDocument, options);
      }
export function useGetNftTransferEventLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetNftTransferEventQuery, GetNftTransferEventQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetNftTransferEventQuery, GetNftTransferEventQueryVariables>(GetNftTransferEventDocument, options);
        }
// @ts-ignore
export function useGetNftTransferEventSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<GetNftTransferEventQuery, GetNftTransferEventQueryVariables>): Apollo.UseSuspenseQueryResult<GetNftTransferEventQuery, GetNftTransferEventQueryVariables>;
export function useGetNftTransferEventSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetNftTransferEventQuery, GetNftTransferEventQueryVariables>): Apollo.UseSuspenseQueryResult<GetNftTransferEventQuery | undefined, GetNftTransferEventQueryVariables>;
export function useGetNftTransferEventSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetNftTransferEventQuery, GetNftTransferEventQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<GetNftTransferEventQuery, GetNftTransferEventQueryVariables>(GetNftTransferEventDocument, options);
        }
export type GetNftTransferEventQueryHookResult = ReturnType<typeof useGetNftTransferEventQuery>;
export type GetNftTransferEventLazyQueryHookResult = ReturnType<typeof useGetNftTransferEventLazyQuery>;
export type GetNftTransferEventSuspenseQueryHookResult = ReturnType<typeof useGetNftTransferEventSuspenseQuery>;
export type GetNftTransferEventQueryResult = Apollo.QueryResult<GetNftTransferEventQuery, GetNftTransferEventQueryVariables>;
export const GetCurrentUserDocument = gql`
    query GetCurrentUser {
  me {
    ...UserFields
    nfts(pagination: {first: 20}) {
      edges {
        node {
          id
          name
          image
          tokenId
          lastPrice
        }
        cursor
      }
      pageInfo {
        hasNextPage
        startCursor
        endCursor
      }
      totalCount
    }
    ownedNFTs(pagination: {first: 20}) {
      edges {
        node {
          id
          name
          image
          tokenId
          lastPrice
        }
        cursor
      }
      pageInfo {
        hasNextPage
        startCursor
        endCursor
      }
      totalCount
    }
    listings(pagination: {first: 20}) {
      edges {
        node {
          id
          nftId
          price
          currency
          status
          createdAt
        }
        cursor
      }
      pageInfo {
        hasNextPage
        startCursor
        endCursor
      }
      totalCount
    }
    auctions(pagination: {first: 20}) {
      edges {
        node {
          id
          nftId
          currentPrice
          status
          endTime
        }
        cursor
      }
      pageInfo {
        hasNextPage
        startCursor
        endCursor
      }
      totalCount
    }
    purchases(pagination: {first: 20}) {
      edges {
        node {
          id
          nftId
          price
          currency
          status
          createdAt
        }
        cursor
      }
      pageInfo {
        hasNextPage
        startCursor
        endCursor
      }
      totalCount
    }
    sales(pagination: {first: 20}) {
      edges {
        node {
          id
          nftId
          price
          currency
          status
          createdAt
        }
        cursor
      }
      pageInfo {
        hasNextPage
        startCursor
        endCursor
      }
      totalCount
    }
  }
}
    ${UserFieldsFragmentDoc}`;

/**
 * __useGetCurrentUserQuery__
 *
 * To run a query within a React component, call `useGetCurrentUserQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetCurrentUserQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetCurrentUserQuery({
 *   variables: {
 *   },
 * });
 */
export function useGetCurrentUserQuery(baseOptions?: Apollo.QueryHookOptions<GetCurrentUserQuery, GetCurrentUserQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetCurrentUserQuery, GetCurrentUserQueryVariables>(GetCurrentUserDocument, options);
      }
export function useGetCurrentUserLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetCurrentUserQuery, GetCurrentUserQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetCurrentUserQuery, GetCurrentUserQueryVariables>(GetCurrentUserDocument, options);
        }
// @ts-ignore
export function useGetCurrentUserSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<GetCurrentUserQuery, GetCurrentUserQueryVariables>): Apollo.UseSuspenseQueryResult<GetCurrentUserQuery, GetCurrentUserQueryVariables>;
export function useGetCurrentUserSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetCurrentUserQuery, GetCurrentUserQueryVariables>): Apollo.UseSuspenseQueryResult<GetCurrentUserQuery | undefined, GetCurrentUserQueryVariables>;
export function useGetCurrentUserSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetCurrentUserQuery, GetCurrentUserQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<GetCurrentUserQuery, GetCurrentUserQueryVariables>(GetCurrentUserDocument, options);
        }
export type GetCurrentUserQueryHookResult = ReturnType<typeof useGetCurrentUserQuery>;
export type GetCurrentUserLazyQueryHookResult = ReturnType<typeof useGetCurrentUserLazyQuery>;
export type GetCurrentUserSuspenseQueryHookResult = ReturnType<typeof useGetCurrentUserSuspenseQuery>;
export type GetCurrentUserQueryResult = Apollo.QueryResult<GetCurrentUserQuery, GetCurrentUserQueryVariables>;
export const GetUserByIdDocument = gql`
    query GetUserById($id: ID!) {
  user(id: $id) {
    ...UserFields
    nfts(pagination: {first: 20}) {
      edges {
        node {
          id
          name
          image
          tokenId
          lastPrice
        }
        cursor
      }
      pageInfo {
        hasNextPage
        startCursor
        endCursor
      }
      totalCount
    }
    ownedNFTs(pagination: {first: 20}) {
      edges {
        node {
          id
          name
          image
          tokenId
          lastPrice
        }
        cursor
      }
      pageInfo {
        hasNextPage
        startCursor
        endCursor
      }
      totalCount
    }
    listings(pagination: {first: 20}) {
      edges {
        node {
          id
          nftId
          price
          currency
          status
          createdAt
        }
        cursor
      }
      pageInfo {
        hasNextPage
        startCursor
        endCursor
      }
      totalCount
    }
    purchases(pagination: {first: 20}) {
      edges {
        node {
          id
          nftId
          price
          currency
          status
          createdAt
        }
        cursor
      }
      pageInfo {
        hasNextPage
        startCursor
        endCursor
      }
      totalCount
    }
    sales(pagination: {first: 20}) {
      edges {
        node {
          id
          nftId
          price
          currency
          status
          createdAt
        }
        cursor
      }
      pageInfo {
        hasNextPage
        startCursor
        endCursor
      }
      totalCount
    }
  }
}
    ${UserFieldsFragmentDoc}`;

/**
 * __useGetUserByIdQuery__
 *
 * To run a query within a React component, call `useGetUserByIdQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetUserByIdQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetUserByIdQuery({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useGetUserByIdQuery(baseOptions: Apollo.QueryHookOptions<GetUserByIdQuery, GetUserByIdQueryVariables> & ({ variables: GetUserByIdQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetUserByIdQuery, GetUserByIdQueryVariables>(GetUserByIdDocument, options);
      }
export function useGetUserByIdLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetUserByIdQuery, GetUserByIdQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetUserByIdQuery, GetUserByIdQueryVariables>(GetUserByIdDocument, options);
        }
// @ts-ignore
export function useGetUserByIdSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<GetUserByIdQuery, GetUserByIdQueryVariables>): Apollo.UseSuspenseQueryResult<GetUserByIdQuery, GetUserByIdQueryVariables>;
export function useGetUserByIdSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetUserByIdQuery, GetUserByIdQueryVariables>): Apollo.UseSuspenseQueryResult<GetUserByIdQuery | undefined, GetUserByIdQueryVariables>;
export function useGetUserByIdSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetUserByIdQuery, GetUserByIdQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<GetUserByIdQuery, GetUserByIdQueryVariables>(GetUserByIdDocument, options);
        }
export type GetUserByIdQueryHookResult = ReturnType<typeof useGetUserByIdQuery>;
export type GetUserByIdLazyQueryHookResult = ReturnType<typeof useGetUserByIdLazyQuery>;
export type GetUserByIdSuspenseQueryHookResult = ReturnType<typeof useGetUserByIdSuspenseQuery>;
export type GetUserByIdQueryResult = Apollo.QueryResult<GetUserByIdQuery, GetUserByIdQueryVariables>;
export const GetUserByAddressDocument = gql`
    query GetUserByAddress($address: String!) {
  userByAddress(address: $address) {
    ...UserFields
    nfts(pagination: {first: 20}) {
      edges {
        node {
          id
          name
          image
          tokenId
        }
        cursor
      }
      pageInfo {
        hasNextPage
        startCursor
        endCursor
      }
      totalCount
    }
  }
}
    ${UserFieldsFragmentDoc}`;

/**
 * __useGetUserByAddressQuery__
 *
 * To run a query within a React component, call `useGetUserByAddressQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetUserByAddressQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetUserByAddressQuery({
 *   variables: {
 *      address: // value for 'address'
 *   },
 * });
 */
export function useGetUserByAddressQuery(baseOptions: Apollo.QueryHookOptions<GetUserByAddressQuery, GetUserByAddressQueryVariables> & ({ variables: GetUserByAddressQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetUserByAddressQuery, GetUserByAddressQueryVariables>(GetUserByAddressDocument, options);
      }
export function useGetUserByAddressLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetUserByAddressQuery, GetUserByAddressQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetUserByAddressQuery, GetUserByAddressQueryVariables>(GetUserByAddressDocument, options);
        }
// @ts-ignore
export function useGetUserByAddressSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<GetUserByAddressQuery, GetUserByAddressQueryVariables>): Apollo.UseSuspenseQueryResult<GetUserByAddressQuery, GetUserByAddressQueryVariables>;
export function useGetUserByAddressSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetUserByAddressQuery, GetUserByAddressQueryVariables>): Apollo.UseSuspenseQueryResult<GetUserByAddressQuery | undefined, GetUserByAddressQueryVariables>;
export function useGetUserByAddressSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetUserByAddressQuery, GetUserByAddressQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<GetUserByAddressQuery, GetUserByAddressQueryVariables>(GetUserByAddressDocument, options);
        }
export type GetUserByAddressQueryHookResult = ReturnType<typeof useGetUserByAddressQuery>;
export type GetUserByAddressLazyQueryHookResult = ReturnType<typeof useGetUserByAddressLazyQuery>;
export type GetUserByAddressSuspenseQueryHookResult = ReturnType<typeof useGetUserByAddressSuspenseQuery>;
export type GetUserByAddressQueryResult = Apollo.QueryResult<GetUserByAddressQuery, GetUserByAddressQueryVariables>;