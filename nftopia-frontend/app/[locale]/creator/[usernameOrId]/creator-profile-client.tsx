"use client";

import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@apollo/client";
import { useParams } from "next/navigation";
import { CircuitBackground } from "@/components/circuit-background";
import { EmptyState } from "@/components/ui/empty-state";
import { CreatorProfileHeader } from "@/components/creator/creator-profile-header";
import { CreatorProfileSkeleton } from "@/components/creator/creator-profile-skeleton";
import { CreatorProfileTabs } from "@/components/creator/creator-profile-tabs";
import { useTranslation } from "@/hooks/useTranslation";
import { GET_PUBLIC_CREATOR_QUERY } from "@/lib/graphql/queries/creator.queries";

type CreatorNftSort = "NEWEST" | "PRICE";

type PublicCreatorData = {
  publicCreator: {
    id: string;
    username?: string | null;
    bio?: string | null;
    avatarUrl?: string | null;
    bannerUrl?: string | null;
    website?: string | null;
    twitterHandle?: string | null;
    instagramHandle?: string | null;
    isVerified: boolean;
    followerCount: number;
    followingCount: number;
    totalNftsCreated: number;
    totalSalesVolume: string;
    createdAt: string;
    isFollowing?: boolean | null;
    nfts?: {
      edges: Array<{
        node: {
          id: string;
          name: string;
          image?: string | null;
          lastPrice?: string | null;
        };
        cursor: string;
      }>;
      pageInfo: { hasNextPage: boolean; endCursor?: string | null };
      totalCount: number;
    } | null;
    collections?: {
      edges: Array<{
        node: {
          id: string;
          name: string;
          image: string;
          floorPrice?: string | null;
          totalSupply?: number | null;
        };
        cursor: string;
      }>;
      pageInfo: { hasNextPage: boolean; endCursor?: string | null };
      totalCount: number;
    } | null;
    activity?: {
      edges: Array<{
        node: {
          type: "MINT" | "SALE" | "LISTING";
          occurredAt: string;
          nftId?: string | null;
          price?: string | null;
          currency?: string | null;
        };
        cursor: string;
      }>;
      totalCount: number;
    } | null;
  };
};

export function CreatorProfileClient() {
  const params = useParams<{ locale: string; usernameOrId: string }>();
  const { t } = useTranslation();
  const identifier = decodeURIComponent(params.usernameOrId);
  const locale = params.locale;

  const [nftSort, setNftSort] = useState<CreatorNftSort>("NEWEST");
  const [nftAfter, setNftAfter] = useState<string | undefined>();
  const [collectionAfter, setCollectionAfter] = useState<string | undefined>();
  const [activityAfter, setActivityAfter] = useState<string | undefined>();

  const { data, loading, error, fetchMore } = useQuery<PublicCreatorData>(
    GET_PUBLIC_CREATOR_QUERY,
    {
      variables: {
        identifier,
        nftSort,
        nftAfter,
        collectionAfter,
        activityAfter,
      },
      fetchPolicy: "cache-and-network",
    },
  );

  const creator = data?.publicCreator;

  const loadMoreNfts = useCallback(async () => {
    const endCursor = creator?.nfts?.pageInfo.endCursor;
    if (!endCursor) return;

    await fetchMore({
      variables: {
        nftAfter: endCursor,
      },
      updateQuery: (previous, { fetchMoreResult }) => {
        if (!fetchMoreResult.publicCreator?.nfts) return previous;

        return {
          publicCreator: {
            ...previous.publicCreator!,
            nfts: {
              ...fetchMoreResult.publicCreator.nfts,
              edges: [
                ...(previous.publicCreator?.nfts?.edges ?? []),
                ...fetchMoreResult.publicCreator.nfts.edges,
              ],
            },
          },
        };
      },
    });
    setNftAfter(endCursor);
  }, [creator?.nfts?.pageInfo.endCursor, fetchMore]);

  const loadMoreCollections = useCallback(async () => {
    const endCursor = creator?.collections?.pageInfo.endCursor;
    if (!endCursor) return;

    await fetchMore({
      variables: {
        collectionAfter: endCursor,
      },
      updateQuery: (previous, { fetchMoreResult }) => {
        if (!fetchMoreResult.publicCreator?.collections) return previous;

        return {
          publicCreator: {
            ...previous.publicCreator!,
            collections: {
              ...fetchMoreResult.publicCreator.collections,
              edges: [
                ...(previous.publicCreator?.collections?.edges ?? []),
                ...fetchMoreResult.publicCreator.collections.edges,
              ],
            },
          },
        };
      },
    });
    setCollectionAfter(endCursor);
  }, [creator?.collections?.pageInfo.endCursor, fetchMore]);

  const loadMoreActivity = useCallback(async () => {
    const lastEdge = creator?.activity?.edges.at(-1);
    if (!lastEdge) return;

    await fetchMore({
      variables: {
        activityAfter: lastEdge.cursor,
      },
      updateQuery: (previous, { fetchMoreResult }) => {
        if (!fetchMoreResult.publicCreator?.activity) return previous;

        return {
          publicCreator: {
            ...previous.publicCreator!,
            activity: {
              ...fetchMoreResult.publicCreator.activity,
              edges: [
                ...(previous.publicCreator?.activity?.edges ?? []),
                ...fetchMoreResult.publicCreator.activity.edges,
              ],
            },
          },
        };
      },
    });
    setActivityAfter(lastEdge.cursor);
  }, [creator?.activity?.edges, fetchMore]);

  const content = useMemo(() => {
    if (loading && !creator) {
      return <CreatorProfileSkeleton />;
    }

    if (error || !creator) {
      return (
        <EmptyState
          title={t("creatorProfile.notFound")}
          description={t("common.error")}
          className="py-20"
        />
      );
    }

    return (
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <CreatorProfileHeader
          creator={creator}
          profileSlug={identifier}
          locale={locale}
        />
        <CreatorProfileTabs
          creator={creator}
          nftSort={nftSort}
          onNftSortChange={(sort) => {
            setNftSort(sort);
            setNftAfter(undefined);
          }}
          onLoadMoreNfts={loadMoreNfts}
          onLoadMoreCollections={loadMoreCollections}
          onLoadMoreActivity={loadMoreActivity}
        />
      </div>
    );
  }, [
    loading,
    creator,
    error,
    t,
    identifier,
    locale,
    nftSort,
    loadMoreNfts,
    loadMoreCollections,
    loadMoreActivity,
  ]);

  return (
    <div className="relative min-h-screen">
      <CircuitBackground />
      <div className="relative z-10">{content}</div>
    </div>
  );
}
