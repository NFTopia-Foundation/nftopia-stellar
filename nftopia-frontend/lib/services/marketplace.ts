import { fetchWithAuth } from "@/lib/api/fetchWithAuth";
import { API_CONFIG } from "@/lib/config";
import type {
  Auction,
  Bid,
  CreateListingDto,
  Listing,
  OwnedNft,
} from "@/types/marketplace";

/**
 * Typed client for the marketplace endpoints (listings, auctions, owned NFTs).
 *
 * Every call goes through {@link fetchWithAuth}, which transparently attaches
 * the creator's JWT and refreshes it on expiry, so callers never deal with auth
 * headers directly. Responses are unwrapped through {@link unwrapData} /
 * {@link unwrapArray} because the API inconsistently nests payloads under
 * `data` / `data.data`.
 *
 * This module is the single network layer shared by both the
 * "List NFTs for Sale" and "Sales" pages.
 */

const jsonHeaders = { "Content-Type": "application/json" };

/** Unwraps a single object that may be nested under `data` / `data.data`. */
function unwrapData<T>(payload: unknown): T {
  const typed = payload as { data?: { data?: T } | T };
  if (typed?.data && typeof typed.data === "object" && "data" in typed.data) {
    return (typed.data as { data: T }).data;
  }
  if (typed && typeof typed === "object" && "data" in typed) {
    return typed.data as T;
  }
  return payload as T;
}

/**
 * Unwraps an array that may arrive bare, under `data`, under `data.data`, or
 * keyed by a collection name (`nfts`, `listings`, `auctions`, `bids`).
 */
function unwrapArray<T>(payload: unknown): T[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload as T[];
  const obj = payload as Record<string, unknown>;
  for (const key of ["data", "nfts", "listings", "auctions", "bids", "items"]) {
    if (Array.isArray(obj[key])) return obj[key] as T[];
  }
  if (obj.data && typeof obj.data === "object") {
    return unwrapArray<T>(obj.data);
  }
  return [];
}

async function getJson(url: string, init?: RequestInit): Promise<unknown> {
  const res = await fetchWithAuth(url, init);
  return res.json();
}

/** Builds the composite NFT key used by `GET /listings/nft/:nftId`. */
export function toNftKey(contractId: string, tokenId: string): string {
  return `${contractId}:${tokenId}`;
}

/** Loads the NFTs an authenticated creator owns and can list for sale. */
export async function getOwnedNfts(
  ownerId: string,
  page = 1,
  limit = 20,
): Promise<OwnedNft[]> {
  const url = `${API_CONFIG.baseUrl}/nfts?ownerId=${encodeURIComponent(
    ownerId,
  )}&page=${page}&limit=${limit}`;
  return unwrapArray<OwnedNft>(await getJson(url));
}

/** Resolves the listing (if any) for a single NFT via its composite key. */
export async function getListingByNft(
  contractId: string,
  tokenId: string,
): Promise<Listing | null> {
  const key = toNftKey(contractId, tokenId);
  const url = `${API_CONFIG.baseUrl}/listings/nft/${encodeURIComponent(key)}`;
  const data = unwrapData<Listing | null>(await getJson(url));
  // The endpoint may return an array, a single object, or nothing.
  if (Array.isArray(data)) return (data[0] as Listing) ?? null;
  return data && (data as Listing).id ? (data as Listing) : null;
}

/** Loads all active listings. */
export async function getActiveListings(): Promise<Listing[]> {
  return unwrapArray<Listing>(
    await getJson(`${API_CONFIG.baseUrl}/listings/active`),
  );
}

/** Loads every listing (any status). */
export async function getAllListings(): Promise<Listing[]> {
  return unwrapArray<Listing>(await getJson(`${API_CONFIG.baseUrl}/listings`));
}

/** Creates a fixed-price listing (JWT required). */
export async function createListing(
  payload: CreateListingDto,
): Promise<Listing> {
  const data = await getJson(`${API_CONFIG.baseUrl}/listings`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(payload),
  });
  return unwrapData<Listing>(data);
}

/** Cancels an active listing by id (JWT required). */
export async function cancelListing(listingId: string): Promise<void> {
  await fetchWithAuth(
    `${API_CONFIG.baseUrl}/listings/${encodeURIComponent(listingId)}`,
    { method: "DELETE" },
  );
}

/** Loads active auctions. */
export async function getActiveAuctions(): Promise<Auction[]> {
  return unwrapArray<Auction>(
    await getJson(`${API_CONFIG.baseUrl}/auctions/active`),
  );
}

/** Loads every auction (any status). */
export async function getAllAuctions(): Promise<Auction[]> {
  return unwrapArray<Auction>(await getJson(`${API_CONFIG.baseUrl}/auctions`));
}

/** Loads the bids for a given auction. */
export async function getAuctionBids(auctionId: string): Promise<Bid[]> {
  return unwrapArray<Bid>(
    await getJson(
      `${API_CONFIG.baseUrl}/auctions/${encodeURIComponent(auctionId)}/bids`,
    ),
  );
}
