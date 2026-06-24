/**
 * Shared marketplace domain types for the creator dashboard.
 *
 * These mirror the backend contracts consumed by both the
 * "List NFTs for Sale" and "Sales" creator pages. They are intentionally the
 * single source of truth for listing/auction shapes on the frontend so the two
 * pages stay consistent (see `lib/services/marketplace.ts`).
 */

/** Lifecycle status of a listing, mirroring the backend `ListingStatus` enum. */
export type ListingStatus = "ACTIVE" | "SOLD" | "CANCELLED" | "EXPIRED";

/** Lifecycle status of an auction, mirroring the backend `AuctionStatus` enum. */
export type AuctionStatus = "ACTIVE" | "COMPLETED" | "CANCELLED" | "SETTLED";

/** A fixed-price listing as returned by `GET /listings`. */
export interface Listing {
  id: string;
  nftContractId: string;
  nftTokenId: string;
  sellerId: string;
  price: number;
  currency: string;
  status: ListingStatus;
  expiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** An auction as returned by `GET /auctions`. */
export interface Auction {
  id: string;
  nftContractId: string;
  nftTokenId: string;
  sellerId: string;
  startPrice: number;
  currentPrice: number;
  reservePrice?: number | null;
  startTime: string;
  endTime: string;
  status: AuctionStatus;
  winnerId?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A single bid on an auction, returned by `GET /auctions/:id/bids`. */
export interface Bid {
  id: string;
  auctionId: string;
  bidderId: string;
  amount: number;
  amountXlm?: string | null;
  createdAt: string;
}

/**
 * Payload accepted by `POST /listings` (`CreateListingDto`).
 * The composite NFT identity is split into contract + token id.
 */
export interface CreateListingDto {
  nftContractId: string;
  nftTokenId: string;
  price: number;
  currency: string;
  /** ISO-8601 timestamp; optional — omit for a listing that never expires. */
  expiresAt?: string;
}

/** A creator-owned NFT as returned by `GET /nfts?ownerId=<creatorId>`. */
export interface OwnedNft {
  id: string;
  contractId: string;
  tokenId: string;
  name?: string;
  description?: string;
  imageUrl?: string;
  ownerId?: string;
  creatorId?: string;
}

/**
 * The normalized, UI-facing listing state for a single owned NFT.
 * Produced by the shared mapper and rendered as a status badge on the
 * "List NFTs for Sale" page.
 */
export type NftMarketState = "NOT_LISTED" | "ACTIVE" | "SOLD" | "EXPIRED";

/** An owned NFT enriched with its resolved marketplace state. */
export interface MarketplaceNft extends OwnedNft {
  /** The composite id used by `GET /listings/nft/:nftId` (`contractId:tokenId`). */
  nftKey: string;
  state: NftMarketState;
  /** The active listing for this NFT, when one exists. */
  listing: Listing | null;
}

/** The kind of marketplace event surfaced in the Sales activity feed. */
export type MarketplaceActivityKind = "LISTING" | "AUCTION";

/**
 * A normalized marketplace event combining listings and auctions into a single
 * shape so the Sales page can render a unified activity feed.
 */
export interface MarketplaceActivity {
  id: string;
  kind: MarketplaceActivityKind;
  nftKey: string;
  status: ListingStatus | AuctionStatus;
  /** Settled/current amount for the event, in the listing/auction currency. */
  amount: number;
  currency: string;
  /** ISO-8601 timestamp used for sorting the feed (most recent first). */
  timestamp: string;
}

/** Aggregated, creator-facing metrics rendered as summary tiles on the Sales page. */
export interface SalesSummary {
  activeListings: number;
  itemsSold: number;
  /** Gross volume across sold listings + settled auctions, in XLM. */
  grossVolume: number;
  currency: string;
}
