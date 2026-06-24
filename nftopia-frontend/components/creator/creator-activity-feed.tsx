"use client";

import Link from "next/link";
import { ArrowUpRight, Gavel, Sparkles, Tag } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ActivityEdge = {
  node: {
    type: "MINT" | "SALE" | "LISTING";
    occurredAt: string;
    nftId?: string | null;
    price?: string | null;
    currency?: string | null;
  };
  cursor: string;
};

type CreatorActivityFeedProps = {
  edges: ActivityEdge[];
  hasNextPage: boolean;
  onLoadMore?: () => void;
  loadingMore?: boolean;
};

const activityIcons = {
  MINT: Sparkles,
  SALE: Gavel,
  LISTING: Tag,
} as const;

export function CreatorActivityFeed({
  edges,
  hasNextPage,
  onLoadMore,
  loadingMore,
}: CreatorActivityFeedProps) {
  const { t } = useTranslation();

  if (!edges.length) {
    return (
      <EmptyState
        title={t("creatorProfile.emptyActivity")}
        className="py-12"
      />
    );
  }

  return (
    <div className="space-y-4">
      <ul className="divide-y divide-gray-800/80 overflow-hidden rounded-xl border border-gray-800/60 bg-gray-900/30">
        {edges.map(({ node, cursor }) => {
          const Icon = activityIcons[node.type];
          const labelKey =
            node.type === "MINT"
              ? "creatorProfile.activityMint"
              : node.type === "SALE"
                ? "creatorProfile.activitySale"
                : "creatorProfile.activityListing";

          return (
            <li key={cursor} className="flex items-center gap-4 px-4 py-3">
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full",
                  node.type === "MINT" && "bg-emerald-500/10 text-emerald-300",
                  node.type === "SALE" && "bg-purple-500/10 text-purple-300",
                  node.type === "LISTING" && "bg-blue-500/10 text-blue-300",
                )}
              >
                <Icon className="h-4 w-4" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm text-white">{t(labelKey)}</p>
                <p className="text-xs text-gray-400">
                  {new Date(node.occurredAt).toLocaleString()}
                </p>
              </div>

              <div className="flex items-center gap-3 text-sm text-gray-300">
                {node.price ? (
                  <span>
                    {Number(node.price).toFixed(2)}{" "}
                    {node.currency || "XLM"}
                  </span>
                ) : null}
                {node.nftId ? (
                  <Link
                    href={`/marketplace/${node.nftId}`}
                    className="inline-flex items-center gap-1 text-purple-300 hover:text-purple-200"
                  >
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      {hasNextPage && onLoadMore ? (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            onClick={onLoadMore}
            disabled={loadingMore}
            className="border-gray-700 bg-transparent text-gray-200"
          >
            {loadingMore ? t("common.loading") : t("common.next")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
