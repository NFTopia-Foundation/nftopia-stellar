"use client";

import Link from "next/link";
import Image from "next/image";
import { useTranslation } from "@/hooks/useTranslation";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

type NftEdge = {
  node: {
    id: string;
    name: string;
    image?: string | null;
    lastPrice?: string | null;
  };
  cursor: string;
};

type CreatorNftGridProps = {
  edges: NftEdge[];
  hasNextPage: boolean;
  onLoadMore?: () => void;
  loadingMore?: boolean;
};

export function CreatorNftGrid({
  edges,
  hasNextPage,
  onLoadMore,
  loadingMore,
}: CreatorNftGridProps) {
  const { t } = useTranslation();

  if (!edges.length) {
    return (
      <EmptyState
        title={t("creatorProfile.emptyNfts")}
        className="py-12"
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {edges.map(({ node }) => (
          <Link
            key={node.id}
            href={`/marketplace/${node.id}`}
            className="group overflow-hidden rounded-xl border border-gray-800/60 bg-gray-900/40 transition hover:-translate-y-0.5 hover:border-purple-500/40"
          >
            <div className="relative aspect-square bg-gray-800/50">
              {node.image ? (
                <Image
                  src={node.image}
                  alt={node.name}
                  fill
                  className="object-cover transition group-hover:scale-[1.02]"
                  unoptimized
                />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-gray-500">
                  {node.name}
                </div>
              )}
            </div>
            <div className="space-y-1 p-3">
              <p className="truncate text-sm font-medium text-white">{node.name}</p>
              {node.lastPrice ? (
                <p className="text-xs text-gray-400">
                  {Number(node.lastPrice).toFixed(2)} XLM
                </p>
              ) : null}
            </div>
          </Link>
        ))}
      </div>

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
