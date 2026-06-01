export type CreatorNFTListingStatus =
  | { kind: "not_listed" }
  | { kind: "active"; listingId: string }
  | { kind: "sold"; listingId: string }
  | { kind: "unknown" };

// NOTE: These types are a frontend normalization layer.
// They intentionally use optional fields because backend responses may evolve.

export type CreatorInventoryNFT = {
  id: string;
  contractId: string;
  tokenId: string;
  name?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  ownerId?: string | null;
};

export type CreatorInventoryItem = {
  nft: CreatorInventoryNFT;
  listing: CreatorNFTListingStatus;
};

export type CreatorSaleActivity = {
  type: "listing" | "auction";
  id: string;
  nftId?: string | null; // contractId:tokenId
  createdAt?: string | null;
  status: "active" | "sold" | "cancelled" | "unknown";
  price?: string | number | null;
  currency?: string | null;
};


export type CreatorSalesSummary = {
  activeListingsCount: number;
  itemsSoldCount: number;
  grossVolume: number; // derived deterministic
  currency?: string | null; // optional best-effort
};

export type CreatorSalesViewModel = {
  summary: CreatorSalesSummary;
  recentActivity: CreatorSaleActivity[];
};

