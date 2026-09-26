import React, { createRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";

// next/image is not meaningful in jsdom; render a plain <img> instead.
jest.mock("next/image", () => {
  const ReactModule = require("react");
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) => {
      const { priority, onLoadingComplete, placeholder, blurDataURL, ...rest } =
        props;
      void priority;
      void onLoadingComplete;
      void placeholder;
      void blurDataURL;
      return ReactModule.createElement("img", rest);
    },
  };
});

import { MarketplaceListingsGrid } from "@/components/marketplace/MarketplaceListingsGrid";
import type { MarketplaceListing } from "@/features/marketplace/api/marketplace-listings";

function listing(id: string): MarketplaceListing {
  return {
    id,
    nftId: `nft-${id}`,
    name: `NFT ${id}`,
    image: null,
    tokenId: id,
    price: "25",
    currency: "XLM",
    status: "ACTIVE",
    seller: "artist",
    cursor: `cursor-${id}`,
  };
}

const baseProps = {
  items: [] as MarketplaceListing[],
  totalCount: 0,
  hasNextPage: false,
  isLoadingFirstPage: false,
  isLoadingMore: false,
  error: null as string | null,
  onLoadMore: jest.fn(),
  onRetry: jest.fn(),
};

describe("MarketplaceListingsGrid", () => {
  beforeEach(() => jest.clearAllMocks());

  it("shows skeletons while the first page loads", () => {
    render(<MarketplaceListingsGrid {...baseProps} isLoadingFirstPage />);

    expect(screen.getByTestId("listings-first-load")).toBeInTheDocument();
    expect(screen.getByTestId("listings-first-load")).toHaveAttribute(
      "aria-live",
      "polite",
    );
  });

  it("shows an empty state when nothing matches the filters", () => {
    render(<MarketplaceListingsGrid {...baseProps} />);

    expect(screen.getByTestId("listings-empty")).toBeInTheDocument();
  });

  it("shows a retryable error when the first page fails", () => {
    const onRetry = jest.fn();
    render(
      <MarketplaceListingsGrid
        {...baseProps}
        error="network down"
        onRetry={onRetry}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("network down");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("renders the loaded count, the rows and the scroll sentinel", () => {
    const sentinelRef = createRef<HTMLDivElement>();
    render(
      <MarketplaceListingsGrid
        {...baseProps}
        items={[listing("1"), listing("2")]}
        totalCount={125}
        hasNextPage
        sentinelRef={sentinelRef}
      />,
    );

    expect(screen.getByTestId("listings-count")).toHaveTextContent(
      "Showing 2 of 125 listings",
    );
    expect(screen.getAllByTestId("marketplace-listing-card")).toHaveLength(2);
    expect(
      screen.getByRole("list", { name: "Marketplace listings" }),
    ).toHaveAttribute("aria-busy", "false");
    expect(sentinelRef.current).toBeInstanceOf(HTMLDivElement);
  });

  it("marks the list busy and disables the button while loading more", () => {
    render(
      <MarketplaceListingsGrid
        {...baseProps}
        items={[listing("1")]}
        totalCount={125}
        hasNextPage
        isLoadingMore
      />,
    );

    expect(
      screen.getByRole("list", { name: "Marketplace listings" }),
    ).toHaveAttribute("aria-busy", "true");
    expect(screen.getByTestId("listings-loading-more")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /loading/i })).toBeDisabled();
  });

  it("loads the next page from the Load more button", () => {
    const onLoadMore = jest.fn();
    render(
      <MarketplaceListingsGrid
        {...baseProps}
        items={[listing("1")]}
        totalCount={125}
        hasNextPage
        onLoadMore={onLoadMore}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Load more" }));

    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it("shows an inline retry when a later page fails", () => {
    const onRetry = jest.fn();
    render(
      <MarketplaceListingsGrid
        {...baseProps}
        items={[listing("1")]}
        totalCount={125}
        hasNextPage
        error="could not load more"
        onRetry={onRetry}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("could not load more");
    fireEvent.click(
      screen.getByRole("button", { name: "Retry loading more" }),
    );
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("announces the end of the list when there is no next page", () => {
    render(
      <MarketplaceListingsGrid
        {...baseProps}
        items={[listing("1")]}
        totalCount={1}
      />,
    );

    expect(
      screen.getByText("You have reached the end of the listings."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Load more" }),
    ).not.toBeInTheDocument();
  });
});
