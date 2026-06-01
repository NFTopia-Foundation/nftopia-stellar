import { API_CONFIG } from "@/lib/config";
import { fetchWithAuth } from "@/lib/api/fetchWithAuth";
import type { BackendAuctionLike, BackendListingLike, BackendNftLike } from "./creatorMarketplaceMapper";

// REST API wrappers for creator pages.

type Paginated<T> = {
  data?: { items?: T[]; total?: number; page?: number; limit?: number };
  items?: T[];
  total?: number;
  page?: number;
  limit?: number;
  // some backends respond as { data: { nfts: [...] } }
  [k: string]: any;
};

function unwrapItems<T>(payload: any, keys: string[]): T[] {
  for (const k of keys) {
    if (payload?.data?.[k] && Array.isArray(payload.data[k])) return payload.data[k];
    if (payload?.[k] && Array.isArray(payload[k])) return payload[k];
  }
  return [];
}

export async function fetchCreatorOwnedNfts(params: {
  ownerId: string;
  page?: number;
  limit?: number;
}): Promise<BackendNftLike[]> {
  const page = params.page ?? 1;
  const limit = params.limit ?? 20;

  const res = await fetch(`${API_CONFIG.baseUrl}/nfts?ownerId=${encodeURIComponent(params.ownerId)}&page=${page}&limit=${limit}`, {
    method: "GET",
    credentials: "include",
  });

  if (!res.ok) throw new Error("Failed to load owned NFTs");
  const payload = await res.json().catch(() => ({}));

  // try common variants
  return (
    unwrapItems<BackendNftLike>(payload, ["nfts", "items"]) || unwrapItems<BackendNftLike>(payload, ["data"]) 
  );
}

export async function fetchListingByNftId(nftId: string): Promise<BackendListingLike | null> {
  const res = await fetch(`${API_CONFIG.baseUrl}/listings/nft/${encodeURIComponent(nftId)}`, {
    method: "GET",
    credentials: "include",
  });

  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to resolve listing state for NFT");
  const payload = await res.json().catch(() => null);

  // try variants
  return payload?.data ?? payload?.listing ?? payload ?? null;
}

export type CreateListingDto = {
  nftContractId: string;
  nftTokenId: string;
  price: number;
  currency: string;
  expiresAt: string;
};

export async function createListing(dto: CreateListingDto): Promise<BackendListingLike> {
  const res = await fetchWithAuth(`${API_CONFIG.baseUrl}/listings`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(dto),
  });

  const payload = await res.json().catch(() => ({}));
  return payload?.data ?? payload?.listing ?? payload;
}

export async function cancelListing(listingId: string): Promise<void> {
  const res = await fetchWithAuth(`${API_CONFIG.baseUrl}/listings/${encodeURIComponent(listingId)}`, {
    method: "DELETE",
    credentials: "include",
  });

  if (!res.ok) throw new Error("Failed to cancel listing");
}

export async function fetchActiveListings(): Promise<BackendListingLike[]> {
  const res = await fetch(`${API_CONFIG.baseUrl}/listings/active`, {
    method: "GET",
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to load active listings");
  const payload = await res.json().catch(() => ({}));
  return unwrapItems<BackendListingLike>(payload, ["listings", "items"]);
}

export async function fetchActiveAuctions(): Promise<BackendAuctionLike[]> {
  const res = await fetch(`${API_CONFIG.baseUrl}/auctions/active`, {
    method: "GET",
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to load active auctions");
  const payload = await res.json().catch(() => ({}));
  return unwrapItems<BackendAuctionLike>(payload, ["auctions", "items"]);
}

