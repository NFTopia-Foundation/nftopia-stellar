"use client";

import { useEffect, useState } from "react";
import { useMutation } from "@apollo/client";
import { Loader2 } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { isBrowserOnline } from "@/lib/offline-queue/connectivity";
import { classifyReplayError } from "@/lib/offline-queue/errors";
import {
  FOLLOW_STATE_EVENT,
  FollowStateEventDetail,
} from "@/lib/offline-queue/optimistic";
import { useOfflineActionQueue } from "@/lib/offline-queue/store";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useStellarWallet } from "@/components/wallet/hooks/useStellarWallet";
import { WalletModal } from "@/components/wallet/WalletModal";
import {
  FOLLOW_CREATOR_MUTATION,
  UNFOLLOW_CREATOR_MUTATION,
} from "@/lib/graphql/queries/creator.queries";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CreatorFollowButtonProps = {
  creatorId: string;
  initialFollowing: boolean;
  initialFollowerCount: number;
  className?: string;
};

export function CreatorFollowButton({
  creatorId,
  initialFollowing,
  initialFollowerCount,
  className,
}: CreatorFollowButtonProps) {
  const { t } = useTranslation();
  const authUser = useAuthStore((state) => state.user);
  const { connected } = useStellarWallet();
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [isFollowing, setIsFollowing] = useState(initialFollowing);
  const [followerCount, setFollowerCount] = useState(initialFollowerCount);
  const enqueue = useOfflineActionQueue((state) => state.enqueue);

  // Conflict resolution ("Use server") emits authoritative state; keep the
  // button in sync with the rest of the app (#663).
  useEffect(() => {
    const handleServerState = (event: Event) => {
      const detail = (event as CustomEvent<FollowStateEventDetail>).detail;
      if (detail?.creatorId !== creatorId) return;
      setIsFollowing(detail.following);
      if (typeof detail.followerCount === "number") {
        setFollowerCount(detail.followerCount);
      }
    };
    window.addEventListener(FOLLOW_STATE_EVENT, handleServerState);
    return () => window.removeEventListener(FOLLOW_STATE_EVENT, handleServerState);
  }, [creatorId]);

  const surfaceConflict = (error: unknown, following: boolean) => {
    const failure = classifyReplayError(error);
    if (failure.kind !== "conflict" || !failure.conflict) return;
    const queue = useOfflineActionQueue.getState();
    const queued = queue.enqueue({
      type: "follow",
      payload: {
        creatorId,
        following,
        previousFollowing: initialFollowing,
        previousFollowerCount: initialFollowerCount,
      },
    });
    queue.markConflict(queued.id, failure.conflict);
  };

  const [followCreator, followState] = useMutation(FOLLOW_CREATOR_MUTATION, {
    optimisticResponse: {
      followCreator: {
        __typename: "FollowResult",
        success: true,
        followerCount: followerCount + 1,
        isFollowing: true,
      },
    },
    onCompleted: (data) => {
      setIsFollowing(data.followCreator.isFollowing);
      setFollowerCount(data.followCreator.followerCount);
    },
    onError: (error) => {
      setIsFollowing(initialFollowing);
      setFollowerCount(initialFollowerCount);
      surfaceConflict(error, true);
    },
  });

  const [unfollowCreator, unfollowState] = useMutation(
    UNFOLLOW_CREATOR_MUTATION,
    {
      optimisticResponse: {
        unfollowCreator: {
          __typename: "FollowResult",
          success: true,
          followerCount: Math.max(0, followerCount - 1),
          isFollowing: false,
        },
      },
      onCompleted: (data) => {
        setIsFollowing(data.unfollowCreator.isFollowing);
        setFollowerCount(data.unfollowCreator.followerCount);
      },
      onError: (error) => {
        setIsFollowing(initialFollowing);
        setFollowerCount(initialFollowerCount);
        surfaceConflict(error, false);
      },
    },
  );

  const loading = followState.loading || unfollowState.loading;
  const isAuthenticated = Boolean(authUser?.id);

  const handleClick = async () => {
    if (!isAuthenticated || !connected) {
      setWalletModalOpen(true);
      return;
    }

    const nextFollowing = !isFollowing;
    const previousCount = followerCount;

    // Optimistic local update, shared by the online and offline paths.
    setIsFollowing(nextFollowing);
    setFollowerCount((count) =>
      nextFollowing ? count + 1 : Math.max(0, count - 1),
    );

    if (!isBrowserOnline()) {
      enqueue({
        type: "follow",
        payload: {
          creatorId,
          following: nextFollowing,
          previousFollowing: isFollowing,
          previousFollowerCount: previousCount,
        },
      });
      return;
    }

    if (!nextFollowing) {
      await unfollowCreator({ variables: { creatorId } });
      return;
    }
    await followCreator({ variables: { creatorId } });
  };

  return (
    <>
      <Button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className={cn(
          "min-w-[108px] bg-gradient-to-r from-[#4e3bff] to-[#9747ff] text-white hover:opacity-90",
          isFollowing && "border border-gray-600 bg-transparent from-transparent to-transparent",
          className,
        )}
        variant={isFollowing ? "outline" : "default"}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isFollowing ? (
          t("common.unfollow")
        ) : (
          t("common.follow")
        )}
      </Button>

      <WalletModal
        open={walletModalOpen}
        onClose={() => setWalletModalOpen(false)}
      />
    </>
  );
}
