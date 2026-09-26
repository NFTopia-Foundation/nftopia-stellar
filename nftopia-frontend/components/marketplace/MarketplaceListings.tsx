"use client";

import { useEffect, useMemo, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ListingStatus } from "@/hooks/graphql/generated";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import {
  fetchMarketplaceListingsPage,
  type MarketplaceListingsFilter,
} from "@/features/marketplace/api/marketplace-listings";
import { useMarketplaceStore } from "@/features/marketplace/store/marketplaceStore";
import { MarketplaceListingsGrid } from "./MarketplaceListingsGrid";

/**
 * Pages a shared `?cursor=` deep link may replay on first load. Bounded so a
 * hand-edited URL cannot make the client hammer the API.
 */
const MAX_RESTORE_PAGES = 10;

function parseNumberParam(value: string): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Container for the paginated marketplace listings: it wires the URL (filters +
 * cursor) to the store's cursor pagination and to `useInfiniteScroll`, and hands
 * everything else to the presentational grid.
 */
export function MarketplaceListings() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const items = useMarketplaceStore((state) => state.items);
  const cursor = useMarketplaceStore((state) => state.cursor);
  const hasNextPage = useMarketplaceStore((state) => state.hasNextPage);
  const totalCount = useMarketplaceStore((state) => state.totalCount);
  const isLoadingMore = useMarketplaceStore((state) => state.isLoadingMore);
  const isLoadingFirstPage = useMarketplaceStore(
    (state) => state.isLoadingFirstPage,
  );
  const paginationError = useMarketplaceStore((state) => state.paginationError);
  const configurePagination = useMarketplaceStore(
    (state) => state.configurePagination,
  );
  const loadFirstPage = useMarketplaceStore((state) => state.loadFirstPage);
  const loadMore = useMarketplaceStore((state) => state.loadMore);
  const setPaginationFilter = useMarketplaceStore(
    (state) => state.setPaginationFilter,
  );

  const search = searchParams.get("search") ?? "";
  const minPrice = searchParams.get("minPrice") ?? "";
  const maxPrice = searchParams.get("maxPrice") ?? "";
  const sortBy = searchParams.get("sortBy") ?? "newest";
  const filterKey = `${search}|${minPrice}|${maxPrice}|${sortBy}`;

  // Only the *first* load honours `?cursor=`; after a filter change the old
  // cursor belongs to a result set that no longer exists.
  const deepLinkCursorRef = useRef(searchParams.get("cursor"));
  const restoredRef = useRef(false);
  const lastWrittenCursorRef = useRef<string | null>(null);

  const filter = useMemo<MarketplaceListingsFilter>(
    () => ({
      search: search || undefined,
      minPrice: parseNumberParam(minPrice),
      maxPrice: parseNumberParam(maxPrice),
      sortBy: sortBy || undefined,
      status: ListingStatus.Active,
    }),
    [search, minPrice, maxPrice, sortBy],
  );

  // Register the transport once; the store itself stays transport-agnostic.
  useEffect(() => {
    configurePagination({ loader: fetchMarketplaceListingsPage });
  }, [configurePagination]);

  // (Re)load page 1 whenever the filters change, then replay a shared cursor.
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setPaginationFilter(filter);
      await loadFirstPage();

      const target = restoredRef.current ? null : deepLinkCursorRef.current;
      restoredRef.current = true;
      if (!target) return;

      for (let page = 0; page < MAX_RESTORE_PAGES && !cancelled; page += 1) {
        const state = useMarketplaceStore.getState();
        if (!state.hasNextPage || state.cursor === target) return;
        await state.loadMore();
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [filterKey, filter, loadFirstPage, setPaginationFilter]);

  // Keep the cursor in the URL so the current position is shareable/bookmarkable.
  useEffect(() => {
    if (lastWrittenCursorRef.current === cursor) return;
    lastWrittenCursorRef.current = cursor;

    const params = new URLSearchParams(searchParams.toString());
    if (cursor) {
      params.set("cursor", cursor);
    } else {
      params.delete("cursor");
    }
    if (params.toString() !== searchParams.toString()) {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }
  }, [cursor, pathname, router, searchParams]);

  const prefersReducedMotion = usePrefersReducedMotion();
  const autoLoadEnabled = !prefersReducedMotion && hasNextPage;

  const sentinelRef = useInfiniteScroll<HTMLDivElement>({
    onLoadMore: () => {
      void loadMore();
    },
    enabled: autoLoadEnabled,
  });

  return (
    <MarketplaceListingsGrid
      items={items}
      totalCount={totalCount}
      hasNextPage={hasNextPage}
      isLoadingFirstPage={isLoadingFirstPage}
      isLoadingMore={isLoadingMore}
      error={paginationError}
      sentinelRef={sentinelRef}
      autoLoadEnabled={autoLoadEnabled}
      onLoadMore={() => {
        void loadMore();
      }}
      // A failed *first* page has nothing to retry against, so restart it.
      onRetry={() => {
        void (items.length === 0 ? loadFirstPage() : loadMore());
      }}
    />
  );
}
