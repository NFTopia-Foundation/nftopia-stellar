import { renderHook, act } from "@testing-library/react";
import { useAuctionBidSubscription } from "../useAuctionBidSubscription";
import { useSubscription } from "@apollo/client";

jest.mock("@apollo/client", () => {
  const original = jest.requireActual("@apollo/client");
  return {
    ...original,
    useSubscription: jest.fn(),
  };
});

describe("useAuctionBidSubscription Hook", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("handles incoming subscription data and fires onBidPlaced callback", () => {
    let capturedOnData: any = null;
    (useSubscription as jest.Mock).mockImplementation((query, options) => {
      capturedOnData = options.onData;
      return {
        data: null,
        loading: false,
        error: undefined,
      };
    });

    const onBidPlaced = jest.fn();
    const { result } = renderHook(() =>
      useAuctionBidSubscription({
        auctionId: "auction-999",
        onBidPlaced,
      })
    );

    const mockBid = {
      id: "bid-100",
      auctionId: "auction-999",
      bidderId: "user-abc",
      amount: "250.0000000",
      createdAt: new Date().toISOString(),
      bidder: {
        id: "user-abc",
        username: "TopBidder",
        walletAddress: "GBB...",
      },
    };

    act(() => {
      if (capturedOnData) {
        capturedOnData({
          data: {
            data: {
              auctionBidPlaced: mockBid,
            },
          },
        });
      }
    });

    expect(onBidPlaced).toHaveBeenCalledWith(mockBid);
    expect(result.current.latestBid).toEqual(mockBid);
    expect(result.current.isSubscribed).toBe(true);
    expect(result.current.shouldFallbackToPolling).toBe(false);
  });

  it("indicates fallbackToPolling when subscription errors", () => {
    let capturedOnError: any = null;
    (useSubscription as jest.Mock).mockImplementation((query, options) => {
      capturedOnError = options.onError;
      return {
        data: null,
        loading: false,
        error: new Error("WebSocket connection failed"),
      };
    });

    const { result } = renderHook(() =>
      useAuctionBidSubscription({
        auctionId: "auction-999",
      })
    );

    act(() => {
      if (capturedOnError) {
        capturedOnError(new Error("Connection timeout"));
      }
    });

    expect(result.current.shouldFallbackToPolling).toBe(true);
    expect(result.current.isSubscribed).toBe(false);
  });
});
