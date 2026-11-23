"use client";

import Link from "next/link";
import { OptimizedImage } from "@/components/image";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "@/hooks/useTranslation";
import { useNFTByIdQuery } from "@/hooks/graphql/useNFTQueries";
import { useRecentlyViewedStore } from "@/lib/stores/recently-viewed-store";

function RecentlyViewedCard({ nftId }: { nftId: string }) {
  const { data, loading } = useNFTByIdQuery({ id: nftId });
  const nft = data?.nft;

  if (loading && !nft) {
    return (
      <div data-testid="recently-viewed-skeleton" className="w-32 shrink-0 space-y-2">
        <Skeleton className="aspect-square w-full rounded-xl" />
        <Skeleton className="h-3 w-3/4" />
      </div>
    );
  }

  // The NFT may since have been removed/unlisted - drop it from the row
  // rather than showing a broken card.
  if (!nft) return null;

  return (
    <Link
      href={`/marketplace/${nftId}`}
      className="w-32 shrink-0 space-y-2 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
    >
      <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-[#120f2e]">
        <OptimizedImage
          src={nft.image || "/nftopia-03.svg"}
          alt={nft.name}
          width={160}
          height={160}
          className="h-full w-full object-cover"
          fallbackSrc="/nftopia-03.svg"
        />
      </div>
      <p className="truncate text-xs font-medium text-white">{nft.name}</p>
    </Link>
  );
}

/**
 * Horizontal row of the user's recently-viewed NFTs, backed by
 * useRecentlyViewedStore (trackView is called from the NFT detail page).
 *
 * Renders nothing at all - not even the section heading - when there's no
 * history yet, mirroring nftopia-mobile-app's RecentlyViewedRow: a caller
 * doesn't need to guard usage with a length check.
 */
export function RecentlyViewedRow() {
  const { t } = useTranslation();
  const items = useRecentlyViewedStore((state) => state.items);
  const clearHistory = useRecentlyViewedStore((state) => state.clearHistory);

  if (items.length === 0) return null;

  return (
    <section aria-labelledby="recently-viewed-heading" className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 id="recently-viewed-heading" className="text-2xl font-bold">
          {t("marketplace.recentlyViewed.title")}
        </h2>
        <button
          type="button"
          onClick={clearHistory}
          className="text-sm font-medium text-purple-400 hover:text-purple-300"
        >
          {t("marketplace.recentlyViewed.clear")}
        </button>
      </div>

      <div
        role="list"
        aria-label={t("marketplace.recentlyViewed.title")}
        className="flex gap-4 overflow-x-auto pb-2"
      >
        {items.map((item) => (
          <div role="listitem" key={item.nftId}>
            <RecentlyViewedCard nftId={item.nftId} />
          </div>
        ))}
      </div>
    </section>
  );
}
