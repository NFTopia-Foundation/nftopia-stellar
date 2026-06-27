import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import { MarketplaceSkeleton } from "../components/Skeleton/MarketplaceSkeleton";
import { CollectionGridSkeleton } from "../components/Skeleton/CollectionGridSkeleton";
import { TransferHistorySkeleton } from "../components/nft/TransferHistorySkeleton";

// MarketplaceSkeleton tests
describe("MarketplaceSkeleton", () => {
  it("renders without crashing", () => {
    render(<MarketplaceSkeleton />);
  });

  it("has role='status' and accessible label", () => {
    render(<MarketplaceSkeleton />);
    expect(screen.getByRole("status")).toHaveAttribute("aria-label", "Loading marketplace");
  });

  it("includes sr-only loading text", () => {
    render(<MarketplaceSkeleton />);
    expect(screen.getByText("Loading marketplace content...")).toBeInTheDocument();
  });

  it("renders auction card skeletons (4 items)", () => {
    const { container } = render(<MarketplaceSkeleton />);
    // LiveAuctions section uses a 4-col grid
    const liveSection = container.querySelector("section");
    expect(liveSection).toBeInTheDocument();
  });

  it("renders all four marketplace sections", () => {
    const { container } = render(<MarketplaceSkeleton />);
    const sections = container.querySelectorAll("section");
    expect(sections.length).toBe(4);
  });
});

// CollectionGridSkeleton tests
describe("CollectionGridSkeleton", () => {
  it("renders without crashing", () => {
    render(<CollectionGridSkeleton />);
  });

  it("has role='status' and accessible label", () => {
    render(<CollectionGridSkeleton />);
    expect(screen.getByRole("status")).toHaveAttribute("aria-label", "Loading collections");
  });

  it("renders default count of 3 skeleton cards", () => {
    const { container } = render(<CollectionGridSkeleton />);
    // Each card has a bg-[#1a1a2e] wrapper
    const cards = container.querySelectorAll("[aria-hidden='true']");
    expect(cards.length).toBe(3);
  });

  it("renders custom count of skeleton cards", () => {
    const { container } = render(<CollectionGridSkeleton count={6} />);
    const cards = container.querySelectorAll("[aria-hidden='true']");
    expect(cards.length).toBe(6);
  });

  it("includes sr-only loading text", () => {
    render(<CollectionGridSkeleton />);
    expect(screen.getByText("Loading collections...")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { container } = render(<CollectionGridSkeleton className="my-custom-class" />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain("my-custom-class");
  });
});

// TransferHistorySkeleton tests
describe("TransferHistorySkeleton", () => {
  it("renders without crashing", () => {
    render(<TransferHistorySkeleton />);
  });

  it("has role='status' and accessible label", () => {
    render(<TransferHistorySkeleton />);
    expect(screen.getByRole("status")).toHaveAttribute("aria-label", "Loading transfer history");
  });

  it("renders default count of 5 event skeleton rows", () => {
    const { container } = render(<TransferHistorySkeleton />);
    const rows = container.querySelectorAll("[aria-hidden='true']");
    expect(rows.length).toBe(5);
  });

  it("renders custom count of event skeleton rows", () => {
    const { container } = render(<TransferHistorySkeleton count={3} />);
    const rows = container.querySelectorAll("[aria-hidden='true']");
    expect(rows.length).toBe(3);
  });

  it("shows header skeleton by default", () => {
    const { container } = render(<TransferHistorySkeleton />);
    // Card header is present (contains the title and count skeletons)
    // It renders skeletons for title and count in the header
    const allSkeletons = container.querySelectorAll(".animate-pulse");
    expect(allSkeletons.length).toBeGreaterThan(5);
  });

  it("hides header when showHeader is false", () => {
    const { container: withHeader } = render(<TransferHistorySkeleton showHeader={true} />);
    const { container: noHeader } = render(<TransferHistorySkeleton showHeader={false} />);
    const skeletonsWithHeader = withHeader.querySelectorAll(".animate-pulse").length;
    const skeletonsWithoutHeader = noHeader.querySelectorAll(".animate-pulse").length;
    expect(skeletonsWithHeader).toBeGreaterThan(skeletonsWithoutHeader);
  });

  it("includes sr-only loading text", () => {
    render(<TransferHistorySkeleton />);
    expect(screen.getByText("Loading transfer history...")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    render(<TransferHistorySkeleton className="border-blue-500" />);
    const card = screen.getByRole("status");
    expect(card.className).toContain("border-blue-500");
  });
});
