import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import {
  FloorPriceDisplay,
  formatFloorPrice,
  calculateTrend,
  Sparkline,
} from "../components/collection/FloorPriceDisplay";
import { CollectionDetailClient } from "../app/[locale]/collection/[id]/CollectionDetailClient";
import CollectionCard from "../components/CollectionCard";

// Mock next/image
jest.mock("next/image", () => {
  return function MockImage({
    src,
    alt,
    fill,
    priority,
    unoptimized,
    onLoadingComplete,
    ...props
  }: any) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt || "mock image"} {...props} />;
  };
});

// Mock next/link
jest.mock("next/link", () => {
  const React = require("react");
  return function MockLink({ children, href, legacyBehavior, passHref, ...rest }: any) {
    if (legacyBehavior && React.isValidElement(children)) {
      return React.cloneElement(children as React.ReactElement<any>, {
        href,
        ...rest,
      });
    }
    return (
      <a href={href} {...rest}>
        {children}
      </a>
    );
  };
});

// Mock telemetry & wallet stores used by components
jest.mock("@/stores/walletStore", () => ({
  useWalletStore: () => ({
    connected: false,
    publicKey: null,
  }),
}));

jest.mock("@/lib/stores", () => ({
  useToast: () => ({
    showSuccess: jest.fn(),
    showError: jest.fn(),
    showWarning: jest.fn(),
  }),
}));

jest.mock("@/hooks/graphql/useCollectionQueries", () => ({
  useLikeCollection: () => ({
    isLiked: false,
    likesCount: 5,
    isLoading: false,
    toggleLike: jest.fn(),
  }),
}));

describe("Floor Price Utilities", () => {
  describe("formatFloorPrice", () => {
    it("formats standard float strings", () => {
      expect(formatFloorPrice("12.5000000")).toBe("12.50");
      expect(formatFloorPrice("0.75")).toBe("0.75");
    });

    it("formats small decimals with 4 digits", () => {
      expect(formatFloorPrice("0.005")).toBe("0.0050");
    });

    it("formats numbers >= 1000 with commas", () => {
      expect(formatFloorPrice(1500.5)).toBe("1,500.50");
    });

    it("handles null, undefined, empty, or 0 gracefully", () => {
      expect(formatFloorPrice(null)).toBe("0.00");
      expect(formatFloorPrice(undefined)).toBe("0.00");
      expect(formatFloorPrice("")).toBe("0.00");
      expect(formatFloorPrice(0)).toBe("0.00");
      expect(formatFloorPrice("invalid")).toBe("0.00");
    });
  });

  describe("calculateTrend", () => {
    it("calculates positive trend correctly", () => {
      const result = calculateTrend([10, 12]);
      expect(result.direction).toBe("up");
      expect(result.percentage).toBe(20);
    });

    it("calculates negative trend correctly", () => {
      const result = calculateTrend([20, 15]);
      expect(result.direction).toBe("down");
      expect(result.percentage).toBe(-25);
    });

    it("calculates neutral trend when values are unchanged", () => {
      const result = calculateTrend([10, 10]);
      expect(result.direction).toBe("neutral");
      expect(result.percentage).toBe(0);
    });

    it("handles empty or single item arrays", () => {
      expect(calculateTrend([]).percentage).toBeNull();
      expect(calculateTrend([10]).percentage).toBeNull();
    });
  });
});

describe("FloorPriceDisplay Component", () => {
  it("renders basic floor price in detailed variant", () => {
    render(<FloorPriceDisplay floorPrice="25.5000000" currency="XLM" />);
    expect(screen.getByText("25.50")).toBeInTheDocument();
    expect(screen.getByText("XLM")).toBeInTheDocument();
    expect(screen.getByText(/Floor Price Tracking/i)).toBeInTheDocument();
  });

  it("renders positive trend indicator with green badge and icon", () => {
    render(
      <FloorPriceDisplay
        floorPrice="30.00"
        trendPercentage={15.5}
        trendDirection="up"
        variant="stat-card"
      />
    );
    expect(screen.getByTestId("trend-icon-up")).toBeInTheDocument();
    expect(screen.getByText("+15.5%")).toBeInTheDocument();
  });

  it("renders negative trend indicator with red badge and icon", () => {
    render(
      <FloorPriceDisplay
        floorPrice="18.00"
        trendPercentage={-8.2}
        trendDirection="down"
        variant="stat-card"
      />
    );
    expect(screen.getByTestId("trend-icon-down")).toBeInTheDocument();
    expect(screen.getByText("-8.2%")).toBeInTheDocument();
  });

  it("renders neutral trend when unchanged", () => {
    render(
      <FloorPriceDisplay
        floorPrice="10.00"
        trendPercentage={0}
        trendDirection="neutral"
        variant="stat-card"
      />
    );
    expect(screen.getByTestId("trend-icon-neutral")).toBeInTheDocument();
    expect(screen.getByText("0.0%")).toBeInTheDocument();
  });

  it("calculates trend automatically from historical prices and displays sparkline", () => {
    render(
      <FloorPriceDisplay
        floorPrice="15.00"
        historicalPrices={[10, 12, 11, 15]}
        variant="detailed"
        showSparkline={true}
      />
    );
    expect(screen.getByTestId("floor-price-sparkline")).toBeInTheDocument();
    expect(screen.getByText("+50.0%")).toBeInTheDocument();
    expect(screen.getByText(/Floor is rising/i)).toBeInTheDocument();
  });

  it("renders compact variant for collection cards", () => {
    render(
      <FloorPriceDisplay
        floorPrice="42.00"
        currency="XLM"
        trendPercentage={5.0}
        variant="compact"
      />
    );
    const compactContainer = screen.getByTestId("floor-price-compact");
    expect(compactContainer).toBeInTheDocument();
    expect(screen.getByText("42.00 XLM")).toBeInTheDocument();
    expect(screen.getByText("+5.0%")).toBeInTheDocument();
  });

  it("renders Sparkline SVG with valid points", () => {
    const { container } = render(
      <Sparkline data={[10, 15, 12, 20]} direction="up" width={80} height={24} />
    );
    const polyline = container.querySelector("polyline");
    expect(polyline).toBeInTheDocument();
    expect(polyline?.getAttribute("points")).toBeTruthy();
  });
});

describe("CollectionDetailClient with Floor Price Tracking", () => {
  const mockCollection = {
    id: "col-123",
    name: "Cosmic Explorers",
    description: "A cosmic collection on Stellar",
    image: "/images/test.png",
    floorPrice: "14.7500000",
    totalVolume: "1200.5000000",
    totalSupply: 50,
    trendPercentage: 12.3,
    trendDirection: "up" as const,
    historicalPrices: [10, 12, 14.75],
    creator: {
      id: "creator-1",
      username: "stellar_artist",
      walletAddress: "GBXXXXX123456789",
    },
    nfts: {
      edges: [],
      totalCount: 50,
    },
  };

  it("renders collection detail page with floor price and trend indicator", () => {
    render(<CollectionDetailClient collection={mockCollection} locale="en" />);
    expect(screen.getByText("Cosmic Explorers")).toBeInTheDocument();
    expect(screen.getByText("14.75")).toBeInTheDocument();
    expect(screen.getByText("+12.3%")).toBeInTheDocument();
    expect(screen.getByTestId("trend-icon-up")).toBeInTheDocument();
    expect(screen.getByText(/Floor Price/i)).toBeInTheDocument();
  });
});

describe("CollectionCard with Compact Floor Price", () => {
  const mockCardCollection = {
    id: "col-456",
    title: "Cyber Guardians",
    creatorName: "CyberStudio",
    creatorImage: "/images/creator.png",
    images: {
      main: "/images/col-main.png",
      secondary1: "/images/col-sub1.png",
      secondary2: "/images/col-sub2.png",
    },
    likes: 42,
    floorPrice: "8.5000000",
    totalVolume: "350.00",
  };

  it("renders compact floor price on collection card", () => {
    render(<CollectionCard collection={mockCardCollection} />);
    expect(screen.getByText("Cyber Guardians")).toBeInTheDocument();
    expect(screen.getByText("Floor Price")).toBeInTheDocument();
    expect(screen.getByText("8.50 XLM")).toBeInTheDocument();
  });
});
