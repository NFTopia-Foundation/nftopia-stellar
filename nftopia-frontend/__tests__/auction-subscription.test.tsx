import React from "react";
import { render, screen, act, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import AuctionDetailClient from "../app/[locale]/marketplace/auction/[auctionId]/AuctionDetailClient";
import { useAuctionBidSubscription } from "../hooks/graphql/useAuctionBidSubscription";
import { createApolloClient } from "../lib/graphql/client";
import { AUCTION_BID_PLACED_SUBSCRIPTION } from "../lib/graphql/queries/auction.queries";

// Store callback passed to useAuctionBidSubscription
let subscriptionCallback: ((bid: any) => void) | null = null;
let subscriptionOptions: any = null;
let mockIsSubscribed = true;
let mockShouldFallbackToPolling = false;

jest.mock("../hooks/graphql/useAuctionBidSubscription", () => ({
  useAuctionBidSubscription: jest.fn((options) => {
    subscriptionOptions = options;
    subscriptionCallback = options.onBidPlaced || null;
    return {
      latestBid: null,
      loading: false,
      error: mockShouldFallbackToPolling ? new Error("WebSocket disconnected") : null,
      isSubscribed: mockIsSubscribed,
      shouldFallbackToPolling: mockShouldFallbackToPolling,
    };
  }),
}));

const mockShowWarning = jest.fn();
const mockShowToast = jest.fn();

jest.mock("@/lib/stores", () => ({
  useToast: () => ({
    showWarning: mockShowWarning,
    showToast: mockShowToast,
    showSuccess: jest.fn(),
    showError: jest.fn(),
  }),
}));

let mockWalletState = {
  connected: true,
  address: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
};

jest.mock("@/stores/walletStore", () => ({
  useWalletStore: () => mockWalletState,
}));

jest.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "auctionDetail.backToAuctions": "Back to Auctions",
        "auctionDetail.currentBid": "Current Bid",
        "auctionDetail.startingPrice": "Starting Price",
        "auctionDetail.timeLeft": "Time Left",
        "auctionDetail.ended": "Auction Ended",
        "auctionDetail.bidHistory": "Bid History",
        "auctionDetail.noBids": "No bids yet. Be the first to bid!",
        "auctionDetail.placeBid": "Place Bid",
        "auctionDetail.bidAmount": "Bid Amount",
        "auctionDetail.enterAmount": "Enter bid amount",
        "auctionDetail.minBid": "Minimum bid",
        "auctionDetail.outbid": "You've been outbid!",
        "auctionDetail.connectToBid": "Connect wallet to bid",
        "auctionDetail.bidding": "Placing bid...",
        "auctionDetail.bidSuccess": "Bid placed successfully!",
        "auctionDetail.countdown.days": "d",
        "auctionDetail.countdown.hours": "h",
        "auctionDetail.countdown.minutes": "m",
        "auctionDetail.countdown.seconds": "s",
      };
      return translations[key] || key;
    },
  }),
}));

jest.mock("next/link", () => {
  return function MockLink({ children, href, ...rest }: any) {
    return (
      <a href={href} {...rest}>
        {children}
      </a>
    );
  };
});

describe("Real-time Auction Bid Subscription & Outbid Notifications (#538)", () => {
  const initialAuction = {
    id: "auction-123",
    nftId: "nft-456",
    sellerId: "user-seller",
    startPrice: "100.0000000",
    currentPrice: "150.0000000",
    startTime: new Date(Date.now() - 3600000).toISOString(),
    endTime: new Date(Date.now() + 86400000).toISOString(),
    status: "ACTIVE",
    highestBid: {
      id: "bid-1",
      amount: "150.0000000",
      bidderId: "user-1",
      bidder: {
        id: "user-1",
        username: "CurrentUser",
        walletAddress: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
      },
      createdAt: new Date(Date.now() - 1800000).toISOString(),
    },
    bids: [
      {
        id: "bid-1",
        amount: "150.0000000",
        bidderId: "user-1",
        bidder: {
          id: "user-1",
          username: "CurrentUser",
          walletAddress: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
        },
        createdAt: new Date(Date.now() - 1800000).toISOString(),
      },
    ],
    nft: {
      id: "nft-456",
      name: "Cyber Punk Stellar #001",
      tokenId: "101",
      description: "A rare cyber collectible on Stellar.",
      image: "https://example.com/nft.png",
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockIsSubscribed = true;
    mockShouldFallbackToPolling = false;
    mockWalletState = {
      connected: true,
      address: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
    };
    global.fetch = jest.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(initialAuction),
      })
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("subscribes to auction bids via useAuctionBidSubscription on mount", () => {
    render(<AuctionDetailClient initialAuction={initialAuction} locale="en" />);

    expect(useAuctionBidSubscription).toHaveBeenCalledWith(
      expect.objectContaining({
        auctionId: "auction-123",
        skip: false,
      })
    );
  });

  it("shows the live status indicator when subscription is active", () => {
    mockIsSubscribed = true;
    render(<AuctionDetailClient initialAuction={initialAuction} locale="en" />);

    const liveBadge = screen.getByTestId("live-status-indicator");
    expect(liveBadge).toBeInTheDocument();
    expect(liveBadge).toHaveTextContent("Live Bids");
  });

  it("updates UI in real-time when a new bid event is received", async () => {
    render(<AuctionDetailClient initialAuction={initialAuction} locale="en" />);

    // Verify initial current bid
    expect(screen.getAllByText(/150\.0000000/)[0]).toBeInTheDocument();

    const newBidEvent = {
      id: "bid-2",
      auctionId: "auction-123",
      bidderId: "user-2",
      amount: "200.0000000",
      createdAt: new Date().toISOString(),
      bidder: {
        id: "user-2",
        username: "RivalBidder",
        walletAddress: "GCRIVAL7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
      },
    };

    // Simulate incoming real-time subscription event
    act(() => {
      if (subscriptionCallback) {
        subscriptionCallback(newBidEvent);
      }
    });

    // Check that the new bid amount is reflected
    expect(screen.getAllByText(/200\.0000000/)[0]).toBeInTheDocument();
    // Check that the new bidder appears in bid history
    expect(screen.getByText("RivalBidder")).toBeInTheDocument();
  });

  it("triggers an outbid warning toast and alert banner when user is outbid", async () => {
    render(<AuctionDetailClient initialAuction={initialAuction} locale="en" />);

    const rivalBid = {
      id: "bid-rival-99",
      auctionId: "auction-123",
      bidderId: "user-rival",
      amount: "250.0000000",
      createdAt: new Date().toISOString(),
      bidder: {
        id: "user-rival",
        username: "RivalBidder",
        walletAddress: "GCRIVAL999999999999999999999999999999999999999999",
      },
    };

    act(() => {
      if (subscriptionCallback) {
        subscriptionCallback(rivalBid);
      }
    });

    // Verify toast notification called
    expect(mockShowWarning).toHaveBeenCalledWith(
      expect.stringContaining("You've been outbid! New highest bid: 250.0000000 XLM")
    );

    // Verify visual outbid notification banner is displayed
    const outbidBanner = screen.getByTestId("outbid-notification");
    expect(outbidBanner).toBeInTheDocument();
    expect(outbidBanner).toHaveTextContent("250.0000000 XLM");

    // Test dismissing outbid banner
    const dismissBtn = screen.getByRole("button", { name: /dismiss outbid alert/i });
    fireEvent.click(dismissBtn);
    expect(screen.queryByTestId("outbid-notification")).not.toBeInTheDocument();
  });

  it("does not trigger outbid alert if the user places their own higher bid", () => {
    render(<AuctionDetailClient initialAuction={initialAuction} locale="en" />);

    const userHigherBid = {
      id: "bid-self-2",
      auctionId: "auction-123",
      bidderId: "user-1",
      amount: "300.0000000",
      createdAt: new Date().toISOString(),
      bidder: {
        id: "user-1",
        username: "CurrentUser",
        walletAddress: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
      },
    };

    act(() => {
      if (subscriptionCallback) {
        subscriptionCallback(userHigherBid);
      }
    });

    expect(mockShowWarning).not.toHaveBeenCalled();
    expect(screen.queryByTestId("outbid-notification")).not.toBeInTheDocument();
  });

  it("falls back to 15-second polling if the WebSocket connection drops", () => {
    mockIsSubscribed = false;
    mockShouldFallbackToPolling = true;

    render(<AuctionDetailClient initialAuction={initialAuction} locale="en" />);

    // Fast-forward 15 seconds
    act(() => {
      jest.advanceTimersByTime(15000);
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/auctions/auction-123")
    );
  });

  it("has valid AUCTION_BID_PLACED_SUBSCRIPTION GraphQL query definition", () => {
    expect(AUCTION_BID_PLACED_SUBSCRIPTION).toBeDefined();
    expect(AUCTION_BID_PLACED_SUBSCRIPTION.definitions[0]).toHaveProperty(
      "operation",
      "subscription"
    );
  });

  it("creates Apollo Client with split link supporting subscriptions", () => {
    const client = createApolloClient();
    expect(client).toBeDefined();
    expect(client.link).toBeDefined();
  });
});
