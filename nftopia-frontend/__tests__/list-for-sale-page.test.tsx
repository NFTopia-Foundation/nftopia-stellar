import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import "@testing-library/jest-dom";

import ListNFTsForSale from "../app/[locale]/creator-dashboard/list-nfts-for-sale/page";
import { useCreatorListings } from "@/hooks/useCreatorListings";
import type { MarketplaceNft } from "@/types/marketplace";

jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img alt="" {...props} />;
  },
}));

const mockShowSuccess = jest.fn();
const mockShowError = jest.fn();
jest.mock("@/lib/stores", () => ({
  useToast: () => ({ showSuccess: mockShowSuccess, showError: mockShowError }),
}));

jest.mock("@/hooks/useCreatorListings", () => ({
  useCreatorListings: jest.fn(),
}));

const mockedHook = useCreatorListings as jest.MockedFunction<
  typeof useCreatorListings
>;

function makeNft(overrides: Partial<MarketplaceNft> = {}): MarketplaceNft {
  return {
    id: "n1",
    contractId: "C1",
    tokenId: "t1",
    name: "Cosmic Cat",
    nftKey: "C1:t1",
    state: "NOT_LISTED",
    listing: null,
    ...overrides,
  };
}

function setHook(partial: Partial<ReturnType<typeof useCreatorListings>>) {
  mockedHook.mockReturnValue({
    nfts: [],
    loading: false,
    error: null,
    isAuthReady: true,
    refetch: jest.fn(),
    createListing: jest.fn().mockResolvedValue(undefined),
    cancelListing: jest.fn().mockResolvedValue(undefined),
    ...partial,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("ListNFTsForSale page", () => {
  it("does not render the grid or empty state while loading", () => {
    setHook({ loading: true });
    render(<ListNFTsForSale />);
    expect(screen.queryByTestId("nft-grid")).not.toBeInTheDocument();
    expect(screen.queryByText("No NFTs to list")).not.toBeInTheDocument();
  });

  it("shows an empty state when the creator owns no NFTs", () => {
    setHook({ nfts: [] });
    render(<ListNFTsForSale />);
    expect(screen.getByText("No NFTs to list")).toBeInTheDocument();
  });

  it("renders an error with a working retry button", () => {
    const refetch = jest.fn();
    setHook({ error: "Network down", refetch });
    render(<ListNFTsForSale />);
    expect(screen.getByText("Network down")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("renders owned NFTs with their market status", () => {
    setHook({
      nfts: [
        makeNft(),
        makeNft({ id: "n2", nftKey: "C2:t2", name: "Listed One", state: "ACTIVE" }),
      ],
    });
    render(<ListNFTsForSale />);
    expect(screen.getByText("Cosmic Cat")).toBeInTheDocument();
    expect(screen.getByText("Not listed")).toBeInTheDocument();
    expect(screen.getByText("Active listing")).toBeInTheDocument();
  });

  it("creates a listing through the inline form", async () => {
    const createListing = jest.fn().mockResolvedValue(undefined);
    setHook({ nfts: [makeNft()], createListing });
    render(<ListNFTsForSale />);

    fireEvent.click(screen.getByRole("button", { name: /list for sale/i }));
    fireEvent.change(screen.getByLabelText(/price/i), {
      target: { value: "25" },
    });
    fireEvent.click(screen.getByRole("button", { name: /confirm/i }));

    await waitFor(() =>
      expect(createListing).toHaveBeenCalledWith(
        expect.objectContaining({ nftKey: "C1:t1" }),
        { price: 25, currency: "XLM" },
      ),
    );
    await waitFor(() => expect(mockShowSuccess).toHaveBeenCalled());
  });

  it("cancels an active listing", async () => {
    const cancelListing = jest.fn().mockResolvedValue(undefined);
    const nft = makeNft({
      state: "ACTIVE",
      listing: {
        id: "l1",
        nftContractId: "C1",
        nftTokenId: "t1",
        sellerId: "creator-1",
        price: 10,
        currency: "XLM",
        status: "ACTIVE",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    });
    setHook({ nfts: [nft], cancelListing });
    render(<ListNFTsForSale />);

    const grid = screen.getByTestId("nft-grid");
    fireEvent.click(
      within(grid).getByRole("button", { name: /cancel listing/i }),
    );

    await waitFor(() => expect(cancelListing).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockShowSuccess).toHaveBeenCalled());
  });
});
