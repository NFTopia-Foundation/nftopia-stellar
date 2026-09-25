import { useSubscription } from "@apollo/client";
import { useEffect, useState, useCallback } from "react";
import { AUCTION_BID_PLACED_SUBSCRIPTION } from "@/lib/graphql/queries/auction.queries";

export interface SubscriptionBidUser {
  id: string;
  username?: string;
  walletAddress?: string;
}

export interface SubscriptionBid {
  id: string;
  auctionId: string;
  bidderId: string;
  amount: string;
  createdAt: string;
  bidder?: SubscriptionBidUser;
}

export interface UseAuctionBidSubscriptionOptions {
  auctionId: string;
  skip?: boolean;
  onBidPlaced?: (bid: SubscriptionBid) => void;
}

export function useAuctionBidSubscription({
  auctionId,
  skip = false,
  onBidPlaced,
}: UseAuctionBidSubscriptionOptions) {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscriptionError, setSubscriptionError] = useState<Error | null>(null);
  const [latestBid, setLatestBid] = useState<SubscriptionBid | null>(null);

  const handleData = useCallback(
    (options: { data: { data?: { auctionBidPlaced?: SubscriptionBid; bidPlaced?: SubscriptionBid } } }) => {
      const bid = options.data?.data?.auctionBidPlaced || options.data?.data?.bidPlaced;
      if (bid) {
        setLatestBid(bid);
        setIsSubscribed(true);
        setSubscriptionError(null);
        if (onBidPlaced) {
          onBidPlaced(bid);
        }
      }
    },
    [onBidPlaced]
  );

  const { data, loading, error } = useSubscription(AUCTION_BID_PLACED_SUBSCRIPTION, {
    variables: { auctionId },
    skip: skip || !auctionId,
    onData: handleData,
    onError: (err) => {
      console.warn(`[useAuctionBidSubscription] Subscription error for auction ${auctionId}:`, err.message);
      setSubscriptionError(err);
      setIsSubscribed(false);
    },
  });

  useEffect(() => {
    if (!loading && !error && !skip) {
      setIsSubscribed(true);
    }
  }, [loading, error, skip]);

  const receivedBid =
    latestBid || data?.auctionBidPlaced || data?.bidPlaced || null;

  return {
    latestBid: receivedBid,
    loading,
    error: error || subscriptionError,
    isSubscribed: isSubscribed && !error && !subscriptionError,
    shouldFallbackToPolling: Boolean(error || subscriptionError),
  };
}
