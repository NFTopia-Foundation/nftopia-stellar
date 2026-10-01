"use client";

import { useEffect, useRef } from "react";

export interface UseInfiniteScrollOptions {
  /** Invoked when the sentinel enters the (expanded) viewport. */
  onLoadMore: () => void;
  /** When false, nothing is observed and no page is prefetched. */
  enabled?: boolean;
  /**
   * Prefetch margin. The sentinel counts as visible this far outside the
   * viewport, so the next page starts loading early. The default (1200px) is
   * roughly two viewports ahead on desktop, which is what keeps the list from
   * stalling while the user is still scrolling.
   */
  rootMargin?: string;
  /** Scroll container, when the list scrolls inside one instead of the page. */
  root?: Element | null;
}

/**
 * Observes a sentinel element with `IntersectionObserver` (no scroll listeners)
 * and calls `onLoadMore` as it approaches the viewport.
 *
 * Returns the ref to attach to the sentinel. Callers must still render a
 * "Load more" button: when the observer is unavailable (SSR, older browsers) or
 * the user prefers reduced motion, that button is the only way to page.
 */
export function useInfiniteScroll<T extends Element = HTMLDivElement>({
  onLoadMore,
  enabled = true,
  rootMargin = "0px 0px 1200px 0px",
  root = null,
}: UseInfiniteScrollOptions) {
  const sentinelRef = useRef<T | null>(null);
  // Keep the latest callback without re-creating the observer on every render.
  const onLoadMoreRef = useRef(onLoadMore);

  useEffect(() => {
    onLoadMoreRef.current = onLoadMore;
  }, [onLoadMore]);

  useEffect(() => {
    if (!enabled) return;
    const node = sentinelRef.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) onLoadMoreRef.current();
        }
      },
      { root, rootMargin },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [enabled, root, rootMargin]);

  return sentinelRef;
}
