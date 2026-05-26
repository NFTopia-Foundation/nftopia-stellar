import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import ListNftsForSalePage from "../app/[locale]/creator-dashboard/list-nfts-for-sale/page";

jest.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    locale: "en",
  }),
}));

const mockUseAuthStore = jest.fn();
jest.mock("@/lib/stores/auth-store", () => ({ useAuthStore: () => mockUseAuthStore() }));

const mockFetchCreatorOwnedNfts = jest.fn();
const mockFetchListingByNftId = jest.fn();
const mockCreateListing = jest.fn();
const mockCancelListing = jest.fn();
const mockNormalizeNftMarketplaceItem = jest.fn();

jest.mock("@/lib/services/marketplace-service", () => ({
  fetchCreatorOwnedNfts: (...args: any[]) => mockFetchCreatorOwnedNfts(...args),
  fetchListingByNftId: (...args: any[]) => mockFetchListingByNftId(...args),
  createListing: (...args: any[]) => mockCreateListing(...args),
  cancelListing: (...args: any[]) => mockCancelListing(...args),
  normalizeNftMarketplaceItem: (...args: any[]) => mockNormalizeNftMarketplaceItem(...args),
}));

describe("List NFTs for Sale page", () => {
  beforeEach(() => {
    mockUseAuthStore.mockReturnValue({ user: { sub: "creator-1" } });
    mockFetchCreatorOwnedNfts.mockResolvedValue([{ id: "1", contractId: "GABC", tokenId: "token-001", name: "Test NFT" }]);
    mockFetchListingByNftId.mockResolvedValue(null);
    mockNormalizeNftMarketplaceItem.mockImplementation((nft) => ({ nft, status: "not_listed" }));
  });

  it("renders a list of creator-owned NFTs and shows list buttons", async () => {
    render(<ListNftsForSalePage />);
    expect(screen.getByText("Loading owned NFTs...")).toBeInTheDocument();

    await waitFor(() => expect(mockFetchCreatorOwnedNfts).toHaveBeenCalled());
    expect(await screen.findByText("Test NFT")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "creatorDashboard.listForSaleButton" })).toBeInTheDocument();
  });

  it("shows validation error when price is missing", async () => {
    render(<ListNftsForSalePage />);
    await waitFor(() => expect(mockFetchCreatorOwnedNfts).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "creatorDashboard.listForSaleButton" }));
    expect(await screen.findByText("Enter a valid price.")).toBeInTheDocument();
  });
});
