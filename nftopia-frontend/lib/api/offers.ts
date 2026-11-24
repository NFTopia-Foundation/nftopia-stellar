/**
 * Marketplace offers API client (#756).
 * Counter-offer: backend has no dedicated counter route — deferred; owners can
 * POST a new offer via createOffer if product later enables owner→bidder offers.
 */

export type MarketplaceOffer = {
  id: string;
  nftId: string;
  amount: string;
  currency: string;
  bidder: string;
  bidderDisplayName?: string;
  expiresAt?: string | null;
  status: "active" | "accepted" | "rejected" | "expired" | string;
};

export type AcceptOfferResult = {
  offer: MarketplaceOffer;
  /** Unsigned Soroban XDR to sign + broadcast when on-chain settlement is on. */
  transactionXdr?: string;
};

const baseUrl = () =>
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:3001";

async function jsonFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(body || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export async function fetchNftOffers(nftId: string): Promise<MarketplaceOffer[]> {
  const data = await jsonFetch<{ offers?: MarketplaceOffer[] } | MarketplaceOffer[]>(
    `/marketplace/nfts/${encodeURIComponent(nftId)}/offers`,
  );
  return Array.isArray(data) ? data : data.offers ?? [];
}

export async function acceptOffer(offerId: string): Promise<AcceptOfferResult> {
  const data = await jsonFetch<
    { offer?: MarketplaceOffer; transactionXdr?: string } | MarketplaceOffer
  >(`/marketplace/offers/${encodeURIComponent(offerId)}/accept`, {
    method: "PUT",
  });
  // Backend returns `{ offer, transactionXdr? }` when on-chain settlement is
  // enabled; tolerate a bare offer payload for backward compatibility.
  if (data && typeof data === "object" && "offer" in data) {
    const payload = data as { offer: MarketplaceOffer; transactionXdr?: string };
    return { offer: payload.offer, transactionXdr: payload.transactionXdr };
  }
  return { offer: data as MarketplaceOffer };
}

export async function createOffer(input: {
  nftId: string;
  amount: string;
  currency: string;
}): Promise<MarketplaceOffer> {
  return jsonFetch(`/marketplace/offers`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}
