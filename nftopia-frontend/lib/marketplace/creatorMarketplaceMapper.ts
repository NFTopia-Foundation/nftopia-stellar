import type {
  CreatorInventoryItem,
  CreatorNFTListingStatus,
  CreatorSalesViewModel,
  CreatorSaleActivity,
  CreatorSalesSummary,
  CreatorInventoryNFT,
} from "./creatorMarketplaceTypes";

// We keep this file purely deterministic + side-effect free.

export type BackendNftLike = {
  id?: string;
  tokenId?: string | number | null;
  contractId?: string;
  contractAddress?: string;
  name?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  ownerId?: string | null;
};

export type BackendListingLike = {
  id?: string;
  nftContractId?: string;
  nftTokenId?: string;
  nftId?: string;
  sellerId?: string;
  price?: string | number | null;
  currency?: string | null;
  status?: string | null;
  createdAt?: string | null;
};

export type BackendAuctionLike = {
  id?: string;
  nftId?: string | null; // contractId:tokenId if backend returns it
  sellerId?: string | null;
  highestBid?: string | number | null;
  reservePrice?: string | number | null;
  status?: string | null;
  endTime?: string | null;
  createdAt?: string | null;
};

function parseMaybeNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(String(v));
  if (!Number.isFinite(n)) return null;
  return n;
}


function coalesceListingStatus(status?: string | null): CreatorNFTListingStatus {
  const s = (status || "").toLowerCase();
  if (s.includes("active")) return { kind: "active", listingId: "" };
  if (s.includes("sold") || s.includes("completed") || s.includes("settled")) {
    return { kind: "sold", listingId: "" };
  }
  if (s.includes("cancel")) return { kind: "unknown" };
  if (!s) return { kind: "unknown" };
  return { kind: "unknown" };
}

export function toCreatorInventoryNFT(nft: BackendNftLike): CreatorInventoryNFT {
  const contractId = nft.contractId ?? nft.contractAddress ?? "";
  const tokenId = nft.tokenId !== null && nft.tokenId !== undefined ? String(nft.tokenId) : "";
  return {
    id: String(nft.id ?? `${contractId}:${tokenId}`),
    contractId,
    tokenId,
    name: nft.name ?? null,
    description: nft.description ?? null,
    imageUrl: nft.imageUrl ?? null,
    ownerId: nft.ownerId ?? null,
  };
}

export function toCreatorListingStatus(listing: BackendListingLike | null | undefined): CreatorNFTListingStatus {
  if (!listing) return { kind: "not_listed" };
  const listingId = listing.id ? String(listing.id) : "";
  const base = coalesceListingStatus(listing.status);

  if (base.kind === "active") return { kind: "active", listingId };
  if (base.kind === "sold") return { kind: "sold", listingId };
  return { kind: "unknown" };
}

export function mapInventoryItems(nfts: BackendNftLike[], listingsByNftId: Record<string, BackendListingLike | null>): CreatorInventoryItem[] {
  return nfts.map((nft) => {
    const creatorNft = toCreatorInventoryNFT(nft);
    const nftIdKey = `${creatorNft.contractId}:${creatorNft.tokenId}`;
    const listing = listingsByNftId[nftIdKey];
    return {
      nft: creatorNft,
      listing: toCreatorListingStatus(listing),
    };
  });
}

export function mapSalesViewModel(params: {
  activeListings: BackendListingLike[];
  auctions: BackendAuctionLike[];
}): CreatorSalesViewModel {
  const { activeListings, auctions } = params;

  const listingActivities: CreatorSaleActivity[] = activeListings.map((l) => {
    const status = (l.status || "active").toLowerCase();
    const mappedStatus: CreatorSaleActivity["status"] = status.includes("cancel")
      ? "cancelled"
      : status.includes("sold") || status.includes("completed")
        ? "sold"
        : "active";

    const nftId = l.nftId
      ? String(l.nftId)
      : l.nftContractId && l.nftTokenId
        ? `${l.nftContractId}:${String(l.nftTokenId)}`
        : null;

    return {
      type: "listing",
      id: String(l.id ?? ""),
      nftId,
      createdAt: l.createdAt ?? null,
      status: mappedStatus,
      price: l.price ?? null,
      currency: l.currency ?? null,
    };
  });

  const auctionActivities: CreatorSaleActivity[] = auctions.map((a) => {
    const status = (a.status || "unknown").toLowerCase();
    const mappedStatus: CreatorSaleActivity["status"] =
      status.includes("sold") || status.includes("completed") || status.includes("settled")
        ? "sold"
        : status.includes("cancel")
          ? "cancelled"
          : status.includes("active")
            ? "active"
            : "unknown";

    return {
      type: "auction",
      id: String(a.id ?? ""),
      nftId: a.nftId ? String(a.nftId) : null,
      createdAt: a.createdAt ?? a.endTime ?? null,
      status: mappedStatus,
      price: a.highestBid ?? a.reservePrice ?? null,
      currency: null, // backend may not expose currency for auctions; keep as null
    };
  });

  const recentActivity = [...listingActivities, ...auctionActivities]
    .filter((x) => x.id)
    .sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    })
    .slice(0, 25);

  // Deterministic derivations:
  // - itemsSoldCount: count activities with status === 'sold'
  // - grossVolume: sum of parseable `price` for sold activities
  const soldActivities = [...listingActivities, ...auctionActivities].filter((x) => x.status === "sold");

  const gross = soldActivities.reduce((acc, a) => {
    const n = parseMaybeNumber(a.price);
    return acc + (n ?? 0);
  }, 0);

  const currency =
    soldActivities
      .map((x) => x.currency)
      .find((c): c is string => typeof c === "string" && c.length > 0) ?? null;

  const summary: CreatorSalesSummary = {
    activeListingsCount: listingActivities.filter((a) => a.status === "active").length,
    itemsSoldCount: soldActivities.length,
    grossVolume: gross,
    currency,
  };

  return { summary, recentActivity };
}

