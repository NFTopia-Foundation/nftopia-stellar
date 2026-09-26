"use client";

import type { Ref } from "react";
import { AlertCircle, PackageOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MarketplaceListingCard } from "./MarketplaceListingCard";
import type { MarketplaceListing } from "@/features/marketplace/api/marketplace-listings";

export interface MarketplaceListingsGridProps {
  items: MarketplaceListing[];
  totalCount: number;
  hasNextPage: boolean;
  isLoadingFirstPage: boolean;
  isLoadingMore: boolean;
  error: string | null;
  /** Sentinel that triggers infinite scroll when it nears the viewport. */
  sentinelRef?: Ref<HTMLDivElement>;
  /** Auto-loading is active (not reduced-motion, more pages available). */
  autoLoadEnabled?: boolean;
  onLoadMore: () => void;
  onRetry: () => void;
  skeletonCount?: number;
}

function ListingsSkeleton({ count }: { count: number }) {
  return (
    <ul
      role="list"
      aria-hidden
      className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
    >
      {Array.from({ length: count }).map((_, index) => (
        <li key={index}>
          <Skeleton className="aspect-square w-full rounded-xl" />
          <Skeleton className="mt-2 h-4 w-3/4" />
          <Skeleton className="mt-2 h-3 w-1/2" />
        </li>
      ))}
    </ul>
  );
}

/**
 * Marketplace listing grid with its loading, empty, error and end-of-list
 * states. Presentational only: pagination state and transport come from the
 * store via `MarketplaceListings`.
 */
export function MarketplaceListingsGrid({
  items,
  totalCount,
  hasNextPage,
  isLoadingFirstPage,
  isLoadingMore,
  error,
  sentinelRef,
  autoLoadEnabled = true,
  onLoadMore,
  onRetry,
  skeletonCount = 8,
}: MarketplaceListingsGridProps) {
  if (isLoadingFirstPage) {
    return (
      <div role="status" aria-live="polite" data-testid="listings-first-load">
        <span className="sr-only">Loading marketplace listings</span>
        <ListingsSkeleton count={skeletonCount} />
      </div>
    );
  }

  if (items.length === 0) {
    return error ? (
      <div
        role="alert"
        data-testid="listings-error"
        className="flex flex-col items-center gap-3 rounded-xl border border-red-500/40 bg-red-500/10 p-6 text-center"
      >
        <AlertCircle aria-hidden className="h-6 w-6 text-red-300" />
        <p className="text-sm text-red-200">{error}</p>
        <Button variant="outline" onClick={onRetry}>
          Try again
        </Button>
      </div>
    ) : (
      <div
        data-testid="listings-empty"
        className="flex flex-col items-center gap-3 rounded-xl border border-white/10 p-8 text-center text-white/70"
      >
        <PackageOpen aria-hidden className="h-6 w-6" />
        <p className="text-sm">No listings match these filters yet.</p>
      </div>
    );
  }

  const loadedCount = items.length;

  return (
    <div className="space-y-6">
      <p
        role="status"
        aria-live="polite"
        data-testid="listings-count"
        className="text-sm text-white/60"
      >
        Showing {loadedCount} of {totalCount} listings
      </p>

      <ul
        role="list"
        aria-busy={isLoadingMore}
        aria-label="Marketplace listings"
        className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
      >
        {items.map((item) => (
          <li key={item.id}>
            <MarketplaceListingCard listing={item} />
          </li>
        ))}
      </ul>

      {isLoadingMore ? (
        <div role="status" aria-live="polite" data-testid="listings-loading-more">
          <span className="sr-only">Loading more listings</span>
          <ListingsSkeleton count={4} />
        </div>
      ) : null}

      {error ? (
        <div
          role="alert"
          data-testid="listings-error"
          className="flex flex-col items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-center"
        >
          <p className="text-sm text-red-200">{error}</p>
          <Button variant="outline" size="sm" onClick={onRetry}>
            Retry loading more
          </Button>
        </div>
      ) : null}

      {/* Infinite-scroll trigger: sits just after the last row so it enters the
          (prefetch-expanded) viewport as the user approaches the end. */}
      <div ref={sentinelRef} aria-hidden className="h-px w-full" />

      {hasNextPage ? (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={onLoadMore}
            disabled={isLoadingMore}
            loading={isLoadingMore}
            loadingText="Loading…"
          >
            Load more
          </Button>
          {/* The button is the fallback path; announce why when it is the only
              way to page (reduced motion). */}
          {!autoLoadEnabled ? (
            <span className="sr-only">
              Automatic loading is disabled for reduced motion.
            </span>
          ) : null}
        </div>
      ) : (
        <p className="text-center text-sm text-white/50">
          You have reached the end of the listings.
        </p>
      )}
    </div>
  );
}
