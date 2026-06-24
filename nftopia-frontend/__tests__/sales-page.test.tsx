import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import "@testing-library/jest-dom";

import SalesPage from "../app/[locale]/creator-dashboard/sales/page";
import { useCreatorSales } from "@/hooks/useCreatorSales";
import type { MarketplaceActivity, SalesSummary } from "@/types/marketplace";

jest.mock("@/hooks/useCreatorSales", () => ({
  useCreatorSales: jest.fn(),
}));

const mockedHook = useCreatorSales as jest.MockedFunction<
  typeof useCreatorSales
>;

const summary: SalesSummary = {
  activeListings: 3,
  itemsSold: 2,
  grossVolume: 150,
  currency: "XLM",
};

const activity: MarketplaceActivity[] = [
  {
    id: "auction:a1",
    kind: "AUCTION",
    nftKey: "C2:t2",
    status: "SETTLED",
    amount: 100,
    currency: "XLM",
    timestamp: "2026-04-01T00:00:00.000Z",
  },
  {
    id: "listing:l1",
    kind: "LISTING",
    nftKey: "C1:t1",
    status: "SOLD",
    amount: 50,
    currency: "XLM",
    timestamp: "2026-03-01T00:00:00.000Z",
  },
];

function setHook(partial: Partial<ReturnType<typeof useCreatorSales>>) {
  mockedHook.mockReturnValue({
    summary: null,
    activity: [],
    loading: false,
    error: null,
    refetch: jest.fn(),
    ...partial,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("SalesPage", () => {
  it("hides summary and feed while loading", () => {
    setHook({ loading: true });
    render(<SalesPage />);
    expect(screen.queryByTestId("sales-summary")).not.toBeInTheDocument();
    expect(screen.queryByTestId("activity-feed")).not.toBeInTheDocument();
  });

  it("renders derived summary tiles from real data", () => {
    setHook({ summary, activity });
    render(<SalesPage />);

    const tiles = screen.getByTestId("sales-summary");
    expect(within(tiles).getByText("Active listings")).toBeInTheDocument();
    expect(within(tiles).getByText("3")).toBeInTheDocument();
    expect(within(tiles).getByText("2")).toBeInTheDocument();
    expect(within(tiles).getByText("150 XLM")).toBeInTheDocument();
  });

  it("renders the combined activity feed", () => {
    setHook({ summary, activity });
    render(<SalesPage />);

    const feed = screen.getByTestId("activity-feed");
    expect(within(feed).getByText(/Auction · C2:t2/)).toBeInTheDocument();
    expect(within(feed).getByText(/Listing · C1:t1/)).toBeInTheDocument();
    expect(within(feed).getByText("100 XLM")).toBeInTheDocument();
    expect(within(feed).getByText("50 XLM")).toBeInTheDocument();
  });

  it("shows an empty state when there is no activity", () => {
    setHook({ summary, activity: [] });
    render(<SalesPage />);
    expect(
      screen.getByText("No marketplace activity yet"),
    ).toBeInTheDocument();
  });

  it("renders an error with a working retry button", () => {
    const refetch = jest.fn();
    setHook({ error: "boom", refetch });
    render(<SalesPage />);
    expect(screen.getByText("boom")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
