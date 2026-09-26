"use client";

import Link from "next/link";
import { OptimizedImage } from "@/components/image";
import { formatAmount } from "@/components/marketplace/format";
import { cn } from "@/lib/utils";
import type { MarketplaceListing } from "@/features/marketplace/api/marketplace-listings";

/**
 * One marketplace row.
 *
 * `content-visibility: auto` + `contain-intrinsic-size` keeps long lists cheap
 * to render: the browser skips layout/paint for rows that are off-screen while
 * still keeping them in the DOM (so find-in-page and the scroll height stay
 * correct). This is the dependency-free alternative to pulling in a windowing
 * library — see the marketplace README note.
 */
export function MarketplaceListingCard({
  listing,
}: {
  listing: MarketplaceListing;
}) {
  const isActive = listing.status === "ACTIVE";

  return (
    <article
      data-testid="marketplace-listing-card"
      className="group flex flex-col overflow-hidden rounded-xl border border-white/10 bg-white/5 transition-colors hover:border-purple-400/40"
      style={{
        contentVisibility: "auto",
        containIntrinsicSize: "320px",
      }}
    >
      <Link
        href={`/marketplace/${listing.nftId}`}
        className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
      >
        <div className="relative aspect-square w-full overflow-hidden bg-[#120f2e]">
          <OptimizedImage
            src={listing.image || "/nftopia-03.svg"}
            alt={listing.name}
            width={400}
            height={400}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            fallbackSrc="/nftopia-03.svg"
          />
          {!isActive ? (
            <span
              className={cn(
                "absolute left-2 top-2 rounded-full px-2 py-0.5 text-xs font-medium",
                "bg-zinc-900/80 text-zinc-200",
              )}
            >
              {listing.status}
            </span>
          ) : null}
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="truncate text-sm font-semibold text-white">
          {listing.name}
        </h3>
        <p className="truncate text-xs text-white/60">
          {listing.tokenId ? `#${listing.tokenId} · ` : ""}
          {listing.seller}
        </p>
        <p className="mt-1 text-sm font-medium text-purple-300">
          {formatAmount(Number(listing.price), listing.currency)}
        </p>
      </div>
    </article>
  );
}
