import { API_CONFIG } from "@/lib/config";
import { fetchWithAuth } from "@/lib/api/fetchWithAuth";

export interface CreatorNft {
  id: string;
  contractId?: string;
  tokenId?: string;
  name?: string;
  description?: string;
  imageUrl?: string;
  ownerId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ListingResponse {
  id: string;
  nftId: string;
  sellerId: string;
  price: string;
  currency: string;
  status: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface AuctionResponse {
  id: string;
  nftId: string;
  sellerId: string;
  reservePrice?: string;
  highestBid?: string;
  currency?: string;
  status: string;
  endTime?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface MarketplaceItem {
  nft: CreatorNft;
  listing?: ListingResponse;
  auction?: AuctionResponse;
  status:
    | "not_listed"
    | "active_listing"
    | "sold"
    | "cancelled"
    | "auction_active"
    | "auction_completed";
}

export interface MarketplaceActivity {
  id: string;
  type: "listing" | "auction";
  label: string;
  date: string;
  amount?: number;
  currency?: string;
  status: string;
  sourceId: string;
}

function normalizeApiResponse(data: any): any {
  if (data === null || data === undefined) {
    return data;
  }
  if (Array.isArray(data)) {
    return data;
  }
  if (typeof data === "object" && data.data !== undefined) {
    return normalizeApiResponse(data.data);
  }
  return data;
}

function parseNftId(nftId?: string) {
  if (!nftId) {
    return { contractId: "", tokenId: "" };
  }
  const [contractId, tokenId] = nftId.split(":");
  return { contractId: contractId || "", tokenId: tokenId || "" };
}

function getStatusFromListing(listing?: ListingResponse) {
  if (!listing) {
    return "not_listed" as const;
  }

  const status = listing.status?.toLowerCase();
  if (status === "active") {
    return "active_listing" as const;
  }
  if (status === "cancelled") {
    return "cancelled" as const;
  }
  return "sold" as const;
}

function parseCreatorNft(source: any): CreatorNft {
  return {
    id: String(source.id || source._id || `${source.contractId}:${source.tokenId}`),
    contractId: source.contractId || source.nftContractId || source.contract?.id || source.contract ?? String(source.id),
    tokenId: source.tokenId || source.nftTokenId || source.token_id || source.tokenId?.toString() || "",
    name: source.name || source.title || "Untitled NFT",
    description: source.description || source.details || "",
    imageUrl: source.imageUrl || source.image || source.mediaUrl || "",
    ownerId: source.ownerId || source.owner_id || source.owner || "",
    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
  };
}

async function parseJsonResponse(response: Response) {
  const payload = await response.json();
  const normalized = normalizeApiResponse(payload);
  return normalized;
}

export async function fetchCreatorOwnedNfts(ownerId: string): Promise<CreatorNft[]> {
  const url = `${API_CONFIG.baseUrl}/nfts?ownerId=${encodeURIComponent(ownerId)}&page=1&limit=20`;
  const response = await fetchWithAuth(url, { method: "GET" });
  if (!response.ok) {
    throw new Error(`Failed to fetch owned NFTs (${response.status})`);
  }

  const result = await parseJsonResponse(response);
  return Array.isArray(result) ? result.map(parseCreatorNft) : [];
}

export async function fetchListingByNftId(
  contractId: string,
  tokenId: string
): Promise<ListingResponse | null> {
  if (!contractId || !tokenId) {
    return null;
  }
  const nftId = encodeURIComponent(`${contractId}:${tokenId}`);
  const response = await fetchWithAuth(`${API_CONFIG.baseUrl}/listings/nft/${nftId}`, { method: "GET" });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Failed to fetch listing for NFT ${contractId}:${tokenId}`);
  }

  const result = await parseJsonResponse(response);
  return result ? (result as ListingResponse) : null;
}

export async function createListing(dto: {
  nftContractId: string;
  nftTokenId: string;
  price: number;
  currency: string;
  expiresAt: string;
}): Promise<ListingResponse> {
  const response = await fetchWithAuth(`${API_CONFIG.baseUrl}/listings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dto),
  });
  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null);
    throw new Error(
      errorPayload?.message || `Failed to create listing (${response.status})`
    );
  }

  const result = await parseJsonResponse(response);
  return result as ListingResponse;
}

export async function cancelListing(listingId: string): Promise<void> {
  const response = await fetchWithAuth(`${API_CONFIG.baseUrl}/listings/${encodeURIComponent(listingId)}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null);
    throw new Error(
      errorPayload?.message || `Failed to cancel listing (${response.status})`
    );
  }
}

export async function fetchCreatorListings(ownerId: string): Promise<ListingResponse[]> {
  const response = await fetchWithAuth(`${API_CONFIG.baseUrl}/listings`, { method: "GET" });
  if (!response.ok) {
    throw new Error(`Failed to fetch listings (${response.status})`);
  }

  const result = await parseJsonResponse(response);
  const listings = Array.isArray(result) ? result : [];
  return listings.filter((item) => String(item.sellerId) === String(ownerId));
}

export async function fetchCreatorAuctions(ownerId: string): Promise<AuctionResponse[]> {
  const response = await fetchWithAuth(`${API_CONFIG.baseUrl}/auctions`, { method: "GET" });
  if (!response.ok) {
    throw new Error(`Failed to fetch auctions (${response.status})`);
  }

  const result = await parseJsonResponse(response);
  const auctions = Array.isArray(result) ? result : [];
  return auctions.filter((item) => String(item.sellerId) === String(ownerId));
}

export function normalizeNftMarketplaceItem(
  nft: CreatorNft,
  listing?: ListingResponse
): MarketplaceItem {
  return {
    nft,
    listing,
    status: getStatusFromListing(listing),
  };
}

export function deriveMarketplaceActivity(
  listings: ListingResponse[],
  auctions: AuctionResponse[]
): {
  activeListings: ListingResponse[];
  itemsSold: number;
  grossVolume: number;
  activities: MarketplaceActivity[];
} {
  const activeListings = listings.filter(
    (listing) => listing.status?.toLowerCase() === "active"
  );

  const completedListings = listings.filter((listing) => {
    const status = listing.status?.toLowerCase();
    return status && status !== "active" && status !== "cancelled";
  });

  const completedAuctions = auctions.filter((auction) => {
    const status = auction.status?.toLowerCase();
    return status === "completed" || status === "settled" || status === "ended";
  });

  const sumValue = (value?: string) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const listingVolume = completedListings.reduce(
    (sum, listing) => sum + sumValue(listing.price),
    0
  );

  const auctionVolume = completedAuctions.reduce(
    (sum, auction) => sum + sumValue(auction.highestBid ?? auction.reservePrice),
    0
  );

  const activities: MarketplaceActivity[] = [
    ...listings.map((listing) => ({
      id: `listing-${listing.id}`,
      type: "listing" as const,
      label: listing.status?.toLowerCase() === "active" ? "Listing active" : `Listing ${listing.status}`,
      date: listing.updatedAt || listing.createdAt,
      amount: sumValue(listing.price),
      currency: listing.currency || "XLM",
      status: listing.status,
      sourceId: listing.id,
    })),
    ...auctions.map((auction) => ({
      id: `auction-${auction.id}`,
      type: "auction" as const,
      label: auction.status?.toLowerCase() === "active" ? "Auction active" : `Auction ${auction.status}`,
      date: auction.updatedAt || auction.createdAt,
      amount: sumValue(auction.highestBid ?? auction.reservePrice),
      currency: auction.currency || "XLM",
      status: auction.status,
      sourceId: auction.id,
    })),
  ];

  activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return {
    activeListings,
    itemsSold: completedListings.length + completedAuctions.length,
    grossVolume: listingVolume + auctionVolume,
    activities,
  };
}
