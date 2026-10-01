# Marketplace components

UI for the marketplace catalogue, plus the client-side cursor pagination that
backs "infinite scroll".

## Cursor pagination

The listing grid loads one cursor page at a time and **appends** it to what is
already rendered. The moving parts:

| Concern | Where |
| --- | --- |
| Page state (`items`, `cursor`, `hasNextPage`, `totalCount`, `isLoadingMore`, `isLoadingFirstPage`, `paginationError`) and the `loadFirstPage` / `loadMore` / `resetPagination` / `setPaginationFilter` actions | `features/marketplace/store/marketplaceStore.ts` |
| Transport: `fetchMarketplaceListingsPage` (reuses `GET_LISTINGS_QUERY`, `pagination: { first, after }`, `fetchPolicy: "network-only"`) | `features/marketplace/api/marketplace-listings.ts` |
| Trigger: `useInfiniteScroll` (`IntersectionObserver` with a 1200px prefetch margin — roughly two viewports early) | `hooks/useInfiniteScroll.ts` |
| Container: URL ⇄ store wiring, cursor replay for deep links | `components/marketplace/MarketplaceListings.tsx` |
| Presentation: skeletons, counts, error/empty/end states | `components/marketplace/MarketplaceListingsGrid.tsx` |

Behaviour guarantees:

- **Append, never replace.** `loadMore` concatenates and de-duplicates by
  listing id, so a cursor that overlaps the previous page cannot produce
  duplicate cards.
- **One request at a time.** `loadMore` is a no-op while a page is already in
  flight, or while the first page is loading, or when `hasNextPage` is false.
- **Failures are retryable.** A failed page keeps its cursor and surfaces
  `paginationError`; retry re-requests the same page. A failed *first* page
  restarts page 1 instead.
- **Filters reset the list.** Both `setPaginationFilter` (server-side) and
  `setFilters` (local) clear every loaded page, so filters always start at
  page 1.
- **URL sync.** Filters already live in the URL (`?search=`, `?sortBy=`,
  `?minPrice=`, `?maxPrice=`). The current cursor is mirrored into `?cursor=`
  for shareability, and a deep link replays pages (bounded to 10) until that
  cursor is reached.
- **Accessibility.** The count and the "loading more" indicator are
  `role="status"` / `aria-live="polite"`, the list carries `aria-busy` while a
  page loads, and the "Load more" button is the explicit fallback whenever
  automatic loading is disabled.

## Reduced motion

`usePrefersReducedMotion` turns *automatic* loading off when the user opts out of
motion; the "Load more" button keeps working, so paging never becomes
impossible — only explicit.

## Virtualization

There is currently **no windowing dependency** in this project (no
`react-window` / `react-virtuoso`). Instead of adding one, cards are rendered
with `content-visibility: auto` plus `contain-intrinsic-size` (see
`MarketplaceListingCard`), which lets the browser skip layout and paint for
off-screen rows while keeping them in the DOM — so find-in-page and the scroll
height stay correct.

Follow-up: if the catalogue regularly runs into the thousands of rows, swap the
grid for a windowing library. The store's `items` array is already the single
source of truth, so that change is contained to `MarketplaceListingsGrid` (and
the sentinel would move to the virtualizer's end-of-list slot).

## Tests

- `features/marketplace/store/__tests__/marketplacePagination.test.ts` — append
  vs replace, de-duplication, in-flight guard, retry, filter resets.
- `hooks/__tests__/useInfiniteScroll.test.tsx` — trigger, disabled, prefetch
  margin, teardown.
- `components/marketplace/__tests__/MarketplaceListingsGrid.test.tsx` —
  skeleton, empty, error/retry, count, `aria-busy`, load-more, end of list.
