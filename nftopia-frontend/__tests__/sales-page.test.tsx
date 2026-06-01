import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import SalesPage from "@/app/[locale]/creator-dashboard/sales/page";
import { useAuthStore } from "@/lib/stores/auth-store";

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
    showError: jest.fn(),
    showSuccess: jest.fn(),
  }),
}));

jest.mock("@/lib/marketplace/creatorMarketplaceApi", () => ({
  fetchActiveListings: jest.fn(),
  fetchActiveAuctions: jest.fn(),
}));

const { fetchActiveListings, fetchActiveAuctions } = require("@/lib/marketplace/creatorMarketplaceApi");

describe("Sales page", () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: { sub: "creator-1", walletAddress: "G" },
      isAuthenticated: true,
      accessToken: null,
      refreshTokenValue: null,
      loading: false,
      error: null,
    } as any);

    fetchActiveListings.mockReset();
    fetchActiveAuctions.mockReset();

    fetchActiveListings.mockResolvedValue([
      {
        id: "l1",
        status: "active",
        nftContractId: "GABC",
        nftTokenId: "token-001",
        price: "10",
        currency: "XLM",
        createdAt: new Date().toISOString(),
      },
      {
        id: "l2",
        status: "sold",
        nftContractId: "GDEF",
        nftTokenId: "token-002",
        price: "5",
        currency: "XLM",
        createdAt: new Date().toISOString(),
      },
    ]);

    fetchActiveAuctions.mockResolvedValue([
      {
        id: "a1",
        status: "sold",
        nftId: "GABC:token-001",
        highestBid: "2",
        createdAt: new Date().toISOString(),
      },
    ]);
  });

  it("renders summary tiles from listing/auction data", async () => {
    render(<SalesPage />);

    await waitFor(() => {
      expect(screen.getByText("creator.sales.title")).toBeInTheDocument();
    });

    await waitFor(() => {
      // active listings count = 1
      expect(screen.getByText("1")).toBeInTheDocument();
    });

    await waitFor(() => {
      // itemsSoldCount = 2 (l2 + a1)
      expect(screen.getByText("2")).toBeInTheDocument();
    });
  });
});

