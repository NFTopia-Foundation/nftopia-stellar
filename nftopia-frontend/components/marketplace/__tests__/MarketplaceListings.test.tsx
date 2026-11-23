import { act, render } from "@testing-library/react";
import { MarketplaceListings } from "../MarketplaceListings";
import { useMarketplaceStore } from "@/features/marketplace/store/marketplaceStore";
import { fetchMarketplaceListingsPage } from "@/features/marketplace/api/marketplace-listings";

let mockSearchParams = new URLSearchParams();

jest.mock("next/navigation", () => ({
  usePathname: () => "/en/marketplace",
  useRouter: () => ({ replace: jest.fn() }),
  useSearchParams: () => mockSearchParams,
}));

jest.mock("@/features/marketplace/api/marketplace-listings", () => {
  const actual = jest.requireActual(
    "@/features/marketplace/api/marketplace-listings",
  );
  return { ...actual, fetchMarketplaceListingsPage: jest.fn() };
});

const mockedFetchPage = jest.mocked(fetchMarketplaceListingsPage);

describe("MarketplaceListings category wiring", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams = new URLSearchParams();
    act(() => {
      useMarketplaceStore.getState().resetPagination();
    });
    mockedFetchPage.mockResolvedValue({
      items: [],
      nextCursor: null,
      hasNextPage: false,
      totalCount: 0,
    });
  });

  it("passes the ?category= URL param through to the server-side filter", async () => {
    mockSearchParams = new URLSearchParams("category=gaming");

    await act(async () => {
      render(<MarketplaceListings />);
    });

    expect(mockedFetchPage).toHaveBeenCalledWith(
      expect.objectContaining({
        filter: expect.objectContaining({ category: "gaming" }),
      }),
    );
  });

  it("omits category from the filter when the URL has none", async () => {
    await act(async () => {
      render(<MarketplaceListings />);
    });

    expect(mockedFetchPage).toHaveBeenCalledWith(
      expect.objectContaining({
        filter: expect.objectContaining({ category: undefined }),
      }),
    );
  });
});
