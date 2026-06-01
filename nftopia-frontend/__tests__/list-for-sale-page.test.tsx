import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import ListNFTsForSalePage from "@/app/[locale]/creator-dashboard/list-nfts-for-sale/page";
import { useAuthStore } from "@/lib/stores/auth-store";
import { fetchWithAuth } from "@/lib/api/fetchWithAuth";

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

jest.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (k: string) => k,
  }),
}));

jest.mock("@/lib/routing", () => ({
  useLocalizedRoute: () => (p: string) => p,
}));

jest.mock("@/lib/stores", () => ({
  useToast: () => ({
    showSuccess: jest.fn(),
    showError: jest.fn(),
  }),
}));

jest.mock("@/lib/api/fetchWithAuth", () => ({
  fetchWithAuth: jest.fn(),
}));

jest.mock("@/lib/marketplace/creatorMarketplaceApi", () => ({
  fetchCreatorOwnedNfts: jest.fn(),
  fetchListingByNftId: jest.fn(),
  createListing: jest.fn(),
  cancelListing: jest.fn(),
}));

const mockFetchCreatorOwnedNfts = require("@/lib/marketplace/creatorMarketplaceApi")
  .fetchCreatorOwnedNfts as jest.Mock;
const mockFetchListingByNftId = require("@/lib/marketplace/creatorMarketplaceApi")
  .fetchListingByNftId as jest.Mock;
const mockCreateListing = require("@/lib/marketplace/creatorMarketplaceApi")
  .createListing as jest.Mock;
const mockCancelListing = require("@/lib/marketplace/creatorMarketplaceApi")
  .cancelListing as jest.Mock;

describe("List NFTs for Sale page", () => {
  beforeEach(() => {
    (fetchWithAuth as jest.Mock).mockReset();
    mockFetchCreatorOwnedNfts.mockReset();
    mockFetchListingByNftId.mockReset();
    mockCreateListing.mockReset();
    mockCancelListing.mockReset();

    useAuthStore.setState({
      user: { sub: "creator-1", walletAddress: "G" },
      isAuthenticated: true,
      accessToken: null,
      refreshTokenValue: null,
      loading: false,
      error: null,
    } as any);

    mockFetchCreatorOwnedNfts.mockResolvedValue([
      {
        id: "nft-1",
        tokenId: "token-001",
        contractId: "GABC",
        ownerId: "creator-1",
        name: "My NFT",
        description: null,
        imageUrl: "http://img",
      },
    ]);

    mockFetchListingByNftId.mockResolvedValue(null);
  });

  it("loads NFTs and shows create listing CTA for not listed items", async () => {
    render(<ListNFTsForSalePage />);

    await waitFor(() => {
      expect(screen.getByText("creator.listForSale.title")).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText("creator.listForSale.actions.create")).toBeInTheDocument();
    });
  });

  it("creates listing then refreshes", async () => {
    // After create, listing should be resolved as active; simulate by changing mock
    mockCreateListing.mockResolvedValue({ id: "listing-1" });
    mockFetchListingByNftId.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: "listing-1",
      status: "active",
      nftContractId: "GABC",
      nftTokenId: "token-001",
    });

    render(<ListNFTsForSalePage />);

    // fill price/currency/expiry inputs
    await screen.findByPlaceholderText("creator.listForSale.placeholders.price");
    const priceInput = screen.getByPlaceholderText(
      "creator.listForSale.placeholders.price",
    ) as HTMLInputElement;
    priceInput.value = "10";
    priceInput.dispatchEvent(new Event("input", { bubbles: true }));

    const dateInput = screen.getByRole("textbox", { hidden: true });
    // fallback: attempt to set the first date input found
    const anyDate = screen.getAllByDisplayValue(/20\d\d-/)[0] as HTMLInputElement | undefined;
    if (anyDate) {
      anyDate.value = "2026-06-01";
      anyDate.dispatchEvent(new Event("input", { bubbles: true }));
    }

    // Click create
    const createBtn = await screen.findByText("creator.listForSale.actions.create");
    createBtn.click();

    await waitFor(() => {
      expect(mockCreateListing).toHaveBeenCalled();
    });
  });

  it("cancels active listing", async () => {
    mockFetchListingByNftId.mockResolvedValueOnce({
      id: "listing-1",
      status: "active",
      nftContractId: "GABC",
      nftTokenId: "token-001",
    });

    render(<ListNFTsForSalePage />);

    const cancelBtn = await screen.findByText("creator.listForSale.actions.cancel");
    cancelBtn.click();

    await waitFor(() => {
      expect(mockCancelListing).toHaveBeenCalledWith("listing-1");
    });
  });
});

