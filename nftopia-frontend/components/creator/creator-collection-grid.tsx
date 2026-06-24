"use client";

import Link from "next/link";
import Image from "next/image";
import { useTranslation } from "@/hooks/useTranslation";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

type CollectionEdge = {
  node: {
    id: string;
    name: string;
    image: string;
    floorPrice?: string | null;
    totalSupply?: number | null;
  };
  cursor: string;
};

type CreatorCollectionGridProps = {
  edges: CollectionEdge[];
  hasNextPage: boolean;
  onLoadMore?: () => void;
  loadingMore?: boolean;
};

export function CreatorCollectionGrid({
  edges,
  hasNextPage,
  onLoadMore,
  loadingMore,
}: CreatorCollectionGridProps) {
  const { t } = useTranslation();

  if (!edges.length) {
    return (
      <EmptyState
        title={t("creatorProfile.emptyCollections")}
        className="py-12"
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {edges.map(({ node }) => (
          <Link
            key={node.id}
            href={`/collection/${node.id}`}
            className="group overflow-hidden rounded-xl border border-gray-800/60 bg-gray-900/40 transition hover:-translate-y-0.5 hover:border-purple-500/40"
          >
            <div className="relative aspect-[4/3] bg-gray-800/50">
              <Image
                src={node.image}
                alt={node.name}
                fill
                className="object-cover transition group-hover:scale-[1.02]"
                unoptimized
              />
            </div>
            <div className="space-y-1 p-4">
              <p className="truncate text-base font-medium text-white">{node.name}</p>
              <div className="flex items-center gap-3 text-xs text-gray-400">
                {node.totalSupply != null ? (
                  <span>{node.totalSupply} items</span>
                ) : null}
                {node.floorPrice ? (
                  <span>{Number(node.floorPrice).toFixed(2)} XLM floor</span>
                ) : null}
              </div>
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
