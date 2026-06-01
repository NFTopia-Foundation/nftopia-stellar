# TODO - Creator marketplace flow (List NFTs for Sale + Sales)

- [ ] Create shared typed mapper + types for creator marketplace listing/auction normalization
- [ ] Implement REST client helpers for creator inventory/listings/auctions using fetchWithAuth
- [ ] Implement `list-nfts-for-sale/page.tsx`:
  - [ ] Auth-gated load of NFTs from `GET /nfts?ownerId=`
  - [ ] Resolve per-NFT listing state via `GET /listings/nft/:contractId:tokenId`
  - [ ] Create listing via `POST /listings` (JWT)
  - [ ] Cancel listing via `DELETE /listings/:id` (JWT)
  - [ ] Refetch/refresh affected UI immediately after mutations
  - [ ] Add loading/empty/error states
- [ ] Implement `sales/page.tsx`:
  - [ ] Auth-gated load of active listing + auction activity
  - [ ] Render summary tiles derived from normalized data
  - [ ] Render recent activity section
  - [ ] Add loading/empty/error states
- [ ] Add tests:
  - [ ] `__tests__/list-for-sale-page.test.tsx`
  - [ ] `__tests__/sales-page.test.tsx`
- [ ] Run frontend tests + lint

