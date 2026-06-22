import {
  auctionToActivity,
  buildActivityFeed,
  deriveSalesSummary,
  listingToActivity,
  toMarketplaceNft,
} from "@/lib/services/marketplace-mapper";
import type { Auction, Listing, OwnedNft } from "@/types/marketplace";

const CREATOR = "creator-1";

function makeListing(overrides: Partial<Listing> = {}): Listing {
  return {
    id: "l1",
    nftContractId: "C1",
    nftTokenId: "t1",
    sellerId: CREATOR,
    price: 10,
    currency: "XLM",
    status: "ACTIVE",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeAuction(overrides: Partial<Auction> = {}): Auction {
  return {
    id: "a1",
    nftContractId: "C2",
    nftTokenId: "t2",
    sellerId: CREATOR,
    startPrice: 5,
    currentPrice: 8,
    startTime: "2026-01-01T00:00:00.000Z",
    endTime: "2026-02-01T00:00:00.000Z",
    status: "ACTIVE",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    ...overrides,
  };
}

const ownedNft: OwnedNft = { id: "n1", contractId: "C1", tokenId: "t1" };

describe("toMarketplaceNft", () => {
  it("marks an NFT as not listed when there is no listing", () => {
    const result = toMarketplaceNft(ownedNft, null);
    expect(result.state).toBe("NOT_LISTED");
    expect(result.listing).toBeNull();
    expect(result.nftKey).toBe("C1:t1");
  });

  it("exposes an active listing and ACTIVE state", () => {
    const listing = makeListing({ status: "ACTIVE" });
    const result = toMarketplaceNft(ownedNft, listing);
    expect(result.state).toBe("ACTIVE");
    expect(result.listing).toEqual(listing);
  });

  it("treats a cancelled listing as not listed and clears the listing", () => {
    const result = toMarketplaceNft(ownedNft, makeListing({ status: "CANCELLED" }));
    expect(result.state).toBe("NOT_LISTED");
    expect(result.listing).toBeNull();
  });

  it("reflects a sold listing without exposing it as active", () => {
    const result = toMarketplaceNft(ownedNft, makeListing({ status: "SOLD" }));
    expect(result.state).toBe("SOLD");
    expect(result.listing).toBeNull();
  });
});

describe("activity normalization", () => {
  it("normalizes a listing into a LISTING activity entry", () => {
    const activity = listingToActivity(makeListing({ price: 12 }));
    expect(activity).toMatchObject({
      kind: "LISTING",
      nftKey: "C1:t1",
      amount: 12,
      currency: "XLM",
    });
  });

  it("uses the auction current price for the activity amount", () => {
    const activity = auctionToActivity(makeAuction({ currentPrice: 9 }));
    expect(activity).toMatchObject({ kind: "AUCTION", amount: 9 });
  });

  it("builds a recency-sorted feed of only the creator's events", () => {
    const listings = [
      makeListing({ id: "mine", updatedAt: "2026-03-01T00:00:00.000Z" }),
      makeListing({ id: "other", sellerId: "someone-else" }),
    ];
    const auctions = [
      makeAuction({ id: "auc", updatedAt: "2026-04-01T00:00:00.000Z" }),
    ];

    const feed = buildActivityFeed(listings, auctions, CREATOR);

    expect(feed).toHaveLength(2);
    // Most recent first: the auction (April) precedes the listing (March).
    expect(feed[0].id).toBe("auction:auc");
    expect(feed[1].id).toBe("listing:mine");
  });
});

describe("deriveSalesSummary", () => {
  it("derives counts and gross volume deterministically", () => {
    const listings = [
      makeListing({ id: "active", status: "ACTIVE" }),
      makeListing({ id: "sold", status: "SOLD", price: 30 }),
      makeListing({ id: "notmine", status: "SOLD", price: 999, sellerId: "x" }),
    ];
    const auctions = [
      makeAuction({ id: "settled", status: "SETTLED", currentPrice: 20 }),
      makeAuction({ id: "live", status: "ACTIVE", currentPrice: 7 }),
    ];

    const summary = deriveSalesSummary(listings, auctions, CREATOR);

    expect(summary.activeListings).toBe(1);
    expect(summary.itemsSold).toBe(2); // 1 sold listing + 1 settled auction
    expect(summary.grossVolume).toBe(50); // 30 + 20
    expect(summary.currency).toBe("XLM");
  });

  it("returns zeroes when the creator has no marketplace data", () => {
    expect(deriveSalesSummary([], [], CREATOR)).toEqual({
      activeListings: 0,
      itemsSold: 0,
      grossVolume: 0,
      currency: "XLM",
    });
  });
});
