# Payment module scope (#532)

`payment.module.ts` was previously an empty shell. This documents the scope decision made when implementing it, and where the line sits against `TransactionModule` and `OrderModule` — the overlap the original issue flagged as undocumented.

## What each module owns

- **`TransactionModule`** owns settlement state — on-chain (Soroban) and off-chain (Stripe/credit-card) alike. `Transaction.state` (`PENDING` → `EXECUTING`/`FAILED` → `COMPLETED`, etc.) is the single source of truth for "did this payment actually go through". It already had (but nothing called) `createOffchainPaymentTransaction` and `confirmOffchainPayment` — the off-chain payment lifecycle's create and confirm steps.
- **`OrderModule`** owns marketplace order records — what was bought, by whom, linked to a listing/auction.
- **`PaymentModule`** does **not** introduce a third, competing record of "payment status". A `Payment` entity duplicating fields `Transaction` already owns would recreate exactly the ambiguity this issue was filed to resolve. Instead it owns two things neither of the other modules had a home for:
  1. **Ingesting and verifying Stripe webhook deliveries**, and routing a confirmed/failed off-chain payment into the existing (previously unreachable) `TransactionService.confirmOffchainPayment`.
  2. **A read-only receipt view** that aggregates Transaction + Order + this module's own webhook history into one response, so a client doesn't need to separately query two modules and reconcile them itself.

## The gap this closes

`ListingService.buy()` already dispatches `CREDIT_CARD`/`STRIPE` payments to `TransactionService.createOffchainPaymentTransaction`, which creates a `PENDING` transaction and expects a webhook to later call `confirmOffchainPayment` to move it to `COMPLETED` or `FAILED`. That confirm step existed but was **dead code** — no controller anywhere called it, so an off-chain payment could never actually be confirmed. `PaymentController`'s `POST /payments/webhooks/stripe` is what makes that reachable.

## What's explicitly out of scope

This module does **not** implement a fiat on-ramp — it does not create Stripe PaymentIntents, does not hold card details, and does not call any billable Stripe API. It only verifies and reacts to webhook events for payments that were already initiated elsewhere (a client-side Stripe Elements integration is expected to create the PaymentIntent and pass its ID through `BuyNftDto.stripePaymentIntentId`, which already existed). Building an actual payment-intent-creation flow is a separate, larger feature and is intentionally not bundled here.

## New surface

- **`PaymentWebhookEvent` entity** (`payment_webhook_events` table) — one row per processed webhook delivery (`providerEventId` unique), recording what happened and which `Transaction` it resolved to. This exists purely for idempotency (Stripe may redeliver the same event) and audit; it is not a payment-state table.
- **`PaymentService`**
  - `handleStripeWebhook(rawBody, signature)` — verifies the signature via the `stripe` SDK, no-ops on a redelivered event ID, and for `payment_intent.succeeded`/`payment_intent.payment_failed` calls `TransactionService.confirmOffchainPayment`. A not-found/already-confirmed outcome is recorded and acknowledged (200) so Stripe stops retrying; any other failure is recorded *and rethrown* so Stripe's automatic retry can succeed once the underlying problem (e.g. a transient DB error) clears.
  - `getPaymentReceipt(transactionId, userId)` — the aggregated read view described above. Access control is delegated to `TransactionService.findById`'s existing buyer/seller check rather than reimplemented.
- **`PaymentController`**
  - `POST /payments/webhooks/stripe` — unauthenticated (Stripe has no JWT); authenticity comes from the signature check inside the service. Needs the *raw* request body, so `main.ts` scopes a `raw()` body parser to exactly this path, ahead of the app's global `json()` parser.
  - `GET /payments/:transactionId/receipt` — JWT-protected.

## Configuration

`STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` (see `.env.example`). Both are required for the webhook endpoint to process events; if either is missing it responds `503` rather than silently skipping signature verification — an unverified webhook must never be able to move real money-adjacent state.

## Tests

`src/modules/payment/payment.config.spec.ts` and `src/modules/payment/payment.service.spec.ts` cover the config resolver and the service (signature verification failure, idempotent redelivery, successful/failed confirmation routing, the retryable-vs-not-retryable error split, and receipt aggregation). No existing `TransactionModule`/`OrderModule` files were modified — `PaymentService` reads `Order` via its own repository injection and calls `TransactionService`'s existing public methods, so neither module's own behavior or tests are affected.
