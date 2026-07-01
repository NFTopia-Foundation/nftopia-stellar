"use client";

import { useState } from "react";
import { useMutation } from "@apollo/client";
import { Loader2 } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
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
    onError: () => {
      setIsFollowing(initialFollowing);
      setFollowerCount(initialFollowerCount);
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
      onError: () => {
        setIsFollowing(initialFollowing);
        setFollowerCount(initialFollowerCount);
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

    if (isFollowing) {
      setIsFollowing(false);
      setFollowerCount((count) => Math.max(0, count - 1));
      await unfollowCreator({ variables: { creatorId } });
      return;
    }

    setIsFollowing(true);
    setFollowerCount((count) => count + 1);
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
