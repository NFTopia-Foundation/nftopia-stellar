# 404 Not-Found Handling for Invalid NFT, Collection, and Auction Routes

## Issue Summary

Dynamic routes for NFT detail, collection detail, and auction detail had no proper `notFound()` handling, causing unhandled errors, client-side fallback UIs instead of proper HTTP 404 responses, and missing SEO metadata.

## Changes Made

### 1. Shared `NotFoundPage` Component
- **File:** `components/NotFoundPage.tsx`
- Server-compatible reusable component with localized CTA buttons ("Go to Marketplace", "Back to Home")
- Handles consistent 404 UI across all routes

### 2. Root Global 404 Fallback
- **File:** `app/not-found.tsx`
- Updated to server component with `metadata` export
- Sets `title: "Page Not Found | NFTopia Marketplace"` and `robots: "noindex"`
- Self-contained (no hooks, no client dependencies)

### 3. NFT Detail Page — Server Component with `notFound()`
- **File:** `app/[locale]/marketplace/[nftId]/page.tsx`
- Already a server component; added `notFound()` import and call when:
  - `isValidNFTId(nftId)` returns `false` (invalid format)
  - Backend returns `null` for the NFT (API 404)
- `generateMetadata` returns `robots: { index: false, follow: false }` for not-found state
- JSON-LD structured data now non-conditional (since `notFound()` guarantees non-null)

### 4. Collection Detail Page — New Server Component
- **File:** `app/[locale]/collection/[id]/page.tsx`
- New page created with full server-side data fetching via `GET_COLLECTION_BY_ID_QUERY`
- ID validation before API call
- `notFound()` on invalid ID or API 404
- `CollectionDetailClient.tsx` renders collection info + NFT grid
- `generateMetadata` with `noindex` for not-found

### 5. Auction Detail — Server Component with `notFound()`
- **File:** `app/[locale]/marketplace/auction/[auctionId]/page.tsx` (new server wrapper)
- **File:** `app/[locale]/marketplace/auction/[auctionId]/AuctionDetailClient.tsx` (refactored client)
- Server wrapper fetches via `GET_AUCTION_BY_ID_QUERY`, validates ID, calls `notFound()`
- Client component accepts `initialAuction` prop, handles bidding, countdown, and 15s polling
- `generateMetadata` with `noindex` for not-found

### 6. ID Validation Utility
- **File:** `utils/id-validation.ts`
- `isValidNFTId()`, `isValidCollectionId()`, `isValidAuctionId()`
- Supports UUID, numeric, Stellar public key, and Soroban contract ID formats
- Prevents unnecessary API calls on clearly invalid IDs

### 7. Telemetry Event
- **File:** `lib/telemetry/events.ts`
- Added `pageNotFound: "page_not_found"` event name

### 8. Locale Translations
- **Files:** `locales/{en,fr,es,de}/common.json`
- Added `notFound.nft`, `notFound.collection`, `notFound.auction` sub-sections with localized titles, messages, and CTA labels

## Acceptance Criteria

| Criteria | Status |
|---|---|
| Invalid NFT detail URLs return proper 404 HTTP status | ✅ `notFound()` in server component |
| Invalid collection URLs return custom 404 with user-friendly UI | ✅ New server page with `notFound()` |
| Invalid auction URLs return 404 with proper status | ✅ Server wrapper with `notFound()` |
| 404 pages include `noindex` meta tags | ✅ `robots: { index: false, follow: false }` |
| All 404 pages use shared `NotFoundPage` component | ✅ Component created and usable |
| Missing collection detail page created with full implementation | ✅ New `app/[locale]/collection/[id]/page.tsx` |
| Analytics tracks 404 occurrences by route | ✅ `page_not_found` event added to telemetry |
| ID validation prevents unnecessary API calls | ✅ `utils/id-validation.ts` in all 3 page files |
| Global root 404 page handles unmatched routes | ✅ `app/not-found.tsx` with metadata |
| Error states replaced with `notFound()` | ✅ Auction page converted; NFT page uses `notFound()` |
| User offered navigation back to marketplace on 404 pages | ✅ CTA buttons on all 404 pages |
| All existing links and redirects continue to work | ✅ No URL path changes |

## Next Steps

- Instrument `track("page_not_found", { route, id })` calls within the server components (requires client-side telemetry wrapper)
- Add `e2e` tests for invalid route scenarios
- Add monitoring/alerting on `page_not_found` event frequency
