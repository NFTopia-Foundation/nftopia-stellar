import type {
  Auction,
  Listing,
  MarketplaceActivity,
  MarketplaceNft,
  NftMarketState,
  OwnedNft,
  SalesSummary,
} from "@/types/marketplace";
import { toNftKey } from "@/lib/services/marketplace";

/**
 * Pure normalization layer shared by the "List NFTs for Sale" and "Sales"
 * pages. Keeping all listing/auction → UI-model logic here (instead of in the
 * page components) is what prevents the two views from drifting apart.
 *
 * Every function is deterministic and side-effect free, which also makes the
 * derivations trivial to unit test.
 */

/** Default currency used when a record omits one (the marketplace is XLM-first). */
const DEFAULT_CURRENCY = "XLM";

/** Maps a raw listing status onto the UI-facing NFT market state. */
function listingStatusToState(listing: Listing): NftMarketState {
  switch (listing.status) {
    case "ACTIVE":
      return "ACTIVE";
    case "SOLD":
      return "SOLD";
    case "EXPIRED":
      return "EXPIRED";
    // A CANCELLED listing leaves the NFT available again.
    case "CANCELLED":
    default:
      return "NOT_LISTED";
  }
}

/**
 * Enriches an owned NFT with its resolved listing state.
 *
 * @param nft - The owned NFT.
 * @param listing - The listing resolved via `GET /listings/nft/:nftId`, or null.
 */
export function toMarketplaceNft(
  nft: OwnedNft,
  listing: Listing | null,
): MarketplaceNft {
  const state: NftMarketState = listing
    ? listingStatusToState(listing)
    : "NOT_LISTED";
  // Only an ACTIVE listing should be treated as the NFT's live listing.
  const activeListing = listing && listing.status === "ACTIVE" ? listing : null;
  return {
    ...nft,
    nftKey: toNftKey(nft.contractId, nft.tokenId),
    state,
    listing: activeListing,
  };
}

/** Normalizes a listing into a unified activity-feed entry. */
export function listingToActivity(listing: Listing): MarketplaceActivity {
  return {
    id: `listing:${listing.id}`,
    kind: "LISTING",
    nftKey: toNftKey(listing.nftContractId, listing.nftTokenId),
    status: listing.status,
    amount: Number(listing.price) || 0,
    currency: listing.currency || DEFAULT_CURRENCY,
    timestamp: listing.updatedAt || listing.createdAt,
  };
}

/** Normalizes an auction into a unified activity-feed entry. */
export function auctionToActivity(auction: Auction): MarketplaceActivity {
  return {
    id: `auction:${auction.id}`,
    kind: "AUCTION",
    nftKey: toNftKey(auction.nftContractId, auction.nftTokenId),
    status: auction.status,
    // currentPrice reflects the latest/settled bid; fall back to the start price.
    amount: Number(auction.currentPrice ?? auction.startPrice) || 0,
    currency: DEFAULT_CURRENCY,
    timestamp: auction.updatedAt || auction.createdAt,
  };
}

/**
 * Builds the combined, recency-sorted activity feed for a creator.
 * Only the creator's own listings/auctions are included.
 */
export function buildActivityFeed(
  listings: Listing[],
  auctions: Auction[],
  creatorId: string,
): MarketplaceActivity[] {
  const mine = (sellerId: string) => sellerId === creatorId;
  const entries: MarketplaceActivity[] = [
    ...listings.filter((l) => mine(l.sellerId)).map(listingToActivity),
    ...auctions.filter((a) => mine(a.sellerId)).map(auctionToActivity),
  ];
  return entries.sort(
    (a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
}

/**
 * Derives the creator's sales summary tiles from raw listing/auction data.
 *
 * Derivations (documented because the API exposes no single summary endpoint):
 * - `activeListings`: count of the creator's listings with status ACTIVE.
 * - `itemsSold`: count of SOLD listings + COMPLETED/SETTLED auctions.
 * - `grossVolume`: sum of SOLD listing prices + settled auction current prices.
 */
export function deriveSalesSummary(
  listings: Listing[],
  auctions: Auction[],
  creatorId: string,
): SalesSummary {
  const myListings = listings.filter((l) => l.sellerId === creatorId);
  const myAuctions = auctions.filter((a) => a.sellerId === creatorId);

  const activeListings = myListings.filter((l) => l.status === "ACTIVE").length;

  const soldListings = myListings.filter((l) => l.status === "SOLD");
  const settledAuctions = myAuctions.filter(
    (a) => a.status === "COMPLETED" || a.status === "SETTLED",
  );

  const itemsSold = soldListings.length + settledAuctions.length;

  const grossVolume =
    soldListings.reduce((sum, l) => sum + (Number(l.price) || 0), 0) +
    settledAuctions.reduce(
      (sum, a) => sum + (Number(a.currentPrice ?? a.startPrice) || 0),
      0,
    );

  return {
    activeListings,
    itemsSold,
    grossVolume,
    currency: DEFAULT_CURRENCY,
  };
}
