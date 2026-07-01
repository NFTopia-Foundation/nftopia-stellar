"use client";

import { useState } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";
import { CreatorNftGrid } from "./creator-nft-grid";
import { CreatorCollectionGrid } from "./creator-collection-grid";
import { CreatorActivityFeed } from "./creator-activity-feed";

type TabKey = "nfts" | "collections" | "activity";

type CreatorProfileTabsProps = {
  creator: {
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
  nftSort: "NEWEST" | "PRICE";
  onNftSortChange: (sort: "NEWEST" | "PRICE") => void;
  onLoadMoreNfts?: () => void;
  onLoadMoreCollections?: () => void;
  onLoadMoreActivity?: () => void;
  loadingMoreNfts?: boolean;
  loadingMoreCollections?: boolean;
  loadingMoreActivity?: boolean;
};

export function CreatorProfileTabs({
  creator,
  nftSort,
  onNftSortChange,
  onLoadMoreNfts,
  onLoadMoreCollections,
  onLoadMoreActivity,
  loadingMoreNfts,
  loadingMoreCollections,
  loadingMoreActivity,
}: CreatorProfileTabsProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabKey>("nfts");

  const tabs: { key: TabKey; label: string }[] = [
    { key: "nfts", label: t("creatorProfile.tabNfts") },
    { key: "collections", label: t("creatorProfile.tabCollections") },
    { key: "activity", label: t("creatorProfile.tabActivity") },
  ];

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-800/80 pb-3">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm transition-colors",
              activeTab === tab.key
                ? "bg-purple-500/20 text-purple-200"
                : "text-gray-400 hover:text-gray-200",
            )}
          >
            {tab.label}
          </button>
        ))}

        {activeTab === "nfts" ? (
          <div className="ml-auto flex gap-2">
            {(["NEWEST", "PRICE"] as const).map((sort) => (
              <button
                key={sort}
                type="button"
                onClick={() => onNftSortChange(sort)}
                className={cn(
                  "rounded-md border px-2 py-1 text-xs",
                  nftSort === sort
                    ? "border-purple-400/60 text-purple-200"
                    : "border-gray-700 text-gray-400",
                )}
              >
                {sort === "NEWEST"
                  ? t("creatorProfile.sortNewest")
                  : t("creatorProfile.sortPrice")}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {activeTab === "nfts" ? (
        <CreatorNftGrid
          edges={creator.nfts?.edges ?? []}
          hasNextPage={creator.nfts?.pageInfo.hasNextPage ?? false}
          onLoadMore={onLoadMoreNfts}
          loadingMore={loadingMoreNfts}
        />
      ) : null}

      {activeTab === "collections" ? (
        <CreatorCollectionGrid
          edges={creator.collections?.edges ?? []}
          hasNextPage={creator.collections?.pageInfo.hasNextPage ?? false}
          onLoadMore={onLoadMoreCollections}
          loadingMore={loadingMoreCollections}
        />
      ) : null}

      {activeTab === "activity" ? (
        <CreatorActivityFeed
          edges={creator.activity?.edges ?? []}
          hasNextPage={
            (creator.activity?.edges.length ?? 0) <
            (creator.activity?.totalCount ?? 0)
          }
          onLoadMore={onLoadMoreActivity}
          loadingMore={loadingMoreActivity}
        />
      ) : null}
    </section>
  );
}
