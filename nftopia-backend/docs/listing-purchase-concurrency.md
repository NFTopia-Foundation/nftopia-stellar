# Listing purchase concurrency (issue #533)

## Problem

`POST /listings/:id/buy` used to be a textbook TOCTOU race:

1. `findOne(id)` — read the listing,
2. check `status === 'ACTIVE'`,
3. run settlement (Soroban),
4. `save({ status: 'SOLD' })`.

Two buyers could both pass step 2 before either committed step 4, so both paid
for the same NFT, the second `save()` silently overwrote the first, and two
on-chain settlements were triggered for one listing.

## Design: claim, settle, finalise

`ListingService.buy()` is now three phases.

### 1. Claim (`ListingService.claimListing`) — serialised

One database transaction, holding a row-level lock:

```sql
BEGIN;
SELECT * FROM listings WHERE id = $1 FOR UPDATE;   -- pessimistic_write
-- in code: status must be ACTIVE, expiresAt not passed, reservedAt is null
UPDATE listings SET "reservedAt" = now(), "reservedBy" = $2 WHERE id = $1;
COMMIT;
```

* The check **and** the write are in the same transaction, so the availability
  decision is atomic.
* Concurrent buyers are mutually exclusive: the second blocks on the row lock,
  then observes the first claimant's `reservedAt` and is rejected before any
  settlement is attempted.
* The lock is intentionally **not** held across settlement. `TransactionService`
  writes the same row while settling; holding the lock would self-deadlock, and
  it would pin a pooled connection across a network round trip. Safety comes
  from the *durable reservation committed first*, which is what guarantees a
  single listing can never produce two settlements.
* `status` deliberately stays `ACTIVE` during the reservation because downstream
  settlement only accepts `ACTIVE` listings. Availability is expressed by
  `reservedAt`, not by a new status.

### 2. Settle

Unchanged payment dispatch (`XLM`/`USDC` on-chain, `BUNDLE`, `CREDIT_CARD`/
`STRIPE` off-chain), run only by the claim winner.

### 3. Finalise

| Settlement outcome                      | Reservation                                       |
| --------------------------------------- | ------------------------------------------------- |
| `completed`                             | listing -> `SOLD`, reservation cleared            |
| `failed` / `cancelled` / `rolled_back`  | reservation cleared (listing buyable again)       |
| webhook-driven failure / throw          | reservation cleared                               |
| `pending` (off-chain intent)            | reservation **kept** until the payment webhook resolves |

A throw from settlement also releases the reservation, so a failed purchase can
never strand a listing.

`reservedAt` / `reservedBy` are cleared through conditional updates
(`WHERE id = ... AND "reservedBy" = ... AND status = 'ACTIVE'`), so a release can
never resurrect a listing that has since been sold.

### Abandoned reservations

A process crash, or an off-chain intent that is never confirmed, would leave a
reservation open forever. `expireListings()` (cron, every minute) first runs
`releaseStaleReservations()`, which clears reservations older than
`LISTING_RESERVATION_TTL_SECONDS` (default **1800s / 30 min**).

## Error contract for the losing buyer

`ListingUnavailableException` extends `ConflictException` (HTTP **409**) and
carries a stable machine-readable code, so the UI can render an explicit
"listing no longer available" state instead of a generic failure:

```json
{
  "statusCode": 409,
  "message": "Listing 3f6… is no longer available (RESERVED): another buyer has already claimed this listing",
  "code": "LISTING_UNAVAILABLE",
  "reason": "RESERVED",
  "path": "/api/v1/listings/3f6…/buy",
  "timestamp": "2026-01-01T00:00:00.000Z"
}
```

`reason` is one of:

| reason       | meaning                                                |
| ------------ | ------------------------------------------------------ |
| `NOT_ACTIVE` | listing is `SOLD`, `CANCELLED`, `EXPIRED`, …           |
| `RESERVED`   | another buyer holds the in-flight purchase reservation |
| `EXPIRED`    | `expiresAt` has passed                                 |

`HttpExceptionFilter` was extended to pass `code` / `reason` through to the
response body; other exceptions are unaffected.

## Optimistic locking

`Listing` gained `@VersionColumn() version`. TypeORM now adds
`AND version = :snapshot` to `save()` calls, so a stale read-modify-write (e.g.
cancel racing a purchase) fails loudly with `OptimisticLockVersionMismatchError`
instead of clobbering. The purchase path itself uses conditional `update()`
statements rather than `save()` because settlement already moved the row and a
version check against the claim-time snapshot would fail spuriously — the
reservation is what makes those writes exclusive.

## Tests

* `listing.purchase-concurrency.spec.ts` — the regression test for this issue.
  Two concurrent `buy()` calls against an in-memory row guarded by a real mutex
  (which models `SELECT ... FOR UPDATE`) must produce **exactly one** success and
  one 409 `LISTING_UNAVAILABLE`, with settlement called **exactly once**. Also
  covers "the loser never starts a settlement" and reservation release on
  failure. Deterministic by construction (a mutex, not `setTimeout` ordering), so
  it cannot flake in CI.
* `listing.service.spec.ts` — claim/reserve/release bookkeeping, the specific
  error code/reason per failure mode, cancel-vs-purchase races, and the stale
  reservation sweeper.

Run with `pnpm test -- listing` (or `npm test -- listing`).

## Audit: same class of race elsewhere (follow-ups)

Audited `nftopia-backend/src/modules/order` and the transaction module for
read-then-write on ownership/availability state. Not fixed here — recorded as
follow-ups:

1. **`OrderService.create()` bundle path** — validates the DTO, then calls
   `settlementClient.createBundle()` with *no* availability check or
   reservation, so two concurrent bundle orders for the same items can both
   reach the contract. Needs an item-level claim analogous to listings (or
   contract-side exclusivity).
2. **`OrderService.updateStatus()`** — plain `findOne` -> mutate -> `save`, with
   no version column on `Order`, so concurrent callers are last-write-wins.
   Same for `executeBundle()` / `cancelBundle()`, which delegate entirely to the
   contract and keep no local state guard. Follow-up: add `@VersionColumn()` to
   `Order` and use conditional updates.
3. **`TransactionService.createAndExecuteListingPurchase*` and
   `createOffchainPaymentTransaction` / `createAndExecuteBundlePurchase`** — each
   performs its own `listing.status !== 'ACTIVE'` check (check-then-act). They
   are now safe for the purchase entry point because `ListingService` claims
   first, but they remain directly reachable. Follow-up: make the reservation
   the single choke point (or move the claim into `TransactionService`).
4. **`TransactionService.confirmOffchainPayment()`** — marks listings `SOLD`
   outside any reservation. The reservation now covers the window until the
   webhook arrives and is swept if it never does. Follow-up: have the webhook
   resolve the reservation explicitly rather than relying on the TTL sweep.
5. **Auctions** (`modules/auction`) — the bid/settle path has the same
   check-then-write shape and was not touched by this change; it deserves the
   same treatment in a follow-up issue.

## Trade-offs / limitations

* Stale-reservation sweeping is time-based. A webhook arriving after
  `LISTING_RESERVATION_TTL_SECONDS` can find the listing sold to someone else.
  Tune the TTL to match your payment provider's intent lifetime.
* The claim is Postgres-specific (`FOR UPDATE`). SQLite-backed setups do not
  support it; the unit tests fake the `DataSource` instead.
