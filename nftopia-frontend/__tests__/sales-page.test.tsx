import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import SalesPage from "../app/[locale]/creator-dashboard/sales/page";

jest.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    locale: "en",
  }),
}));

const mockUseAuthStore = jest.fn();
jest.mock("@/lib/stores/auth-store", () => ({ useAuthStore: () => mockUseAuthStore() }));

const mockFetchCreatorListings = jest.fn();
const mockFetchCreatorAuctions = jest.fn();

jest.mock("@/lib/services/marketplace-service", () => ({
  fetchCreatorListings: (...args: any[]) => mockFetchCreatorListings(...args),
  fetchCreatorAuctions: (...args: any[]) => mockFetchCreatorAuctions(...args),
  deriveMarketplaceActivity: (listings: any[], auctions: any[]) => ({
    activeListings: listings.filter((listing) => listing.status === "active"),
    itemsSold: listings.length,
    grossVolume: listings.reduce((sum: number, listing: any) => sum + Number(listing.price), 0),
    activities: listings.map((listing: any) => ({
      id: `listing-${listing.id}`,
      type: "listing",
      label: "Listing active",
      date: listing.createdAt,
      amount: Number(listing.price),
      currency: listing.currency,
      status: listing.status,
      sourceId: listing.id,
    })),
  }),
}));

describe("Sales page", () => {
  beforeEach(() => {
    mockUseAuthStore.mockReturnValue({ user: { sub: "creator-1" } });
    mockFetchCreatorListings.mockResolvedValue([
      { id: "list-1", sellerId: "creator-1", price: "10", currency: "XLM", status: "active", createdAt: "2026-01-01T00:00:00Z", nftId: "GABC:token-001" },
    ]);
    mockFetchCreatorAuctions.mockResolvedValue([]);
  });

  it("renders sales summary tiles and recent activity", async () => {
    render(<SalesPage />);
    expect(screen.getByText("Loading sales and auction activity...")).toBeInTheDocument();

    await waitFor(() => expect(mockFetchCreatorListings).toHaveBeenCalled());
    expect(await screen.findByText("Active listings")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });
});
