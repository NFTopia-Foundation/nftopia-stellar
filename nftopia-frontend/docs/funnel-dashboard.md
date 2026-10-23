# Internal funnel drop-off dashboard (#662)

`/internal/funnel-dashboard` visualizes session counts and drop-off at each
stage of the funnel already instrumented via `lib/telemetry/funnel`, so
reviewing a conversion problem no longer means leaving the codebase for an
external analytics provider's UI.

## Why this needed more than a page

Before this issue, `lib/telemetry/funnel` had the *types* for funnel events
(`FunnelStageEnteredPayload`, etc.), a route→stage resolver, and a
journey-session state machine — but nothing ever actually called
`telemetry.track()` with them. There was no real funnel data anywhere, not
even in the external provider. Closing that gap was part of this work:

```
hooks/useFunnelStageTracking.ts        (NEW — the missing dispatch call)
  → lib/telemetry/funnel/stage-resolver.ts   (already existed)
  → lib/telemetry/funnel/journey-session.ts  (already existed)
  → telemetry.track('funnel_stage_entered' | 'funnel_stage_exited', ...)
      → lib/telemetry/client.ts's main `adapter` (PostHog/GA4/noop, per config)
      → lib/telemetry/funnel/internal-sink.ts (NEW — always active for
        funnel_* events, regardless of the main adapter)
          → POST nftopia-backend /analytics/events
            → MongoDB `analytics_events` collection (already existed, #531 —
              this is the ingestion endpoint its schema docstring
              anticipated but that never got built until now)

GET /analytics/funnel/summary (admin-only)
  → AnalyticsEventService.countDistinctSessionsByStage()
  → the dashboard page, which applies FUNNEL_STAGE_SEQUENCE's order and
    computes drop-off % between consecutive stages
```

## Adding a new funnel step

1. Add the stage to the `FunnelStage` enum (and `FunnelStageName` type) in
   `lib/telemetry/funnel/types.ts`.
2. Add a route pattern for it to `ROUTE_TO_STAGE_MAP` in
   `lib/telemetry/funnel/stage-resolver.ts`, so navigating there actually
   fires the stage.
3. Insert it into `FUNNEL_STAGE_SEQUENCE` in
   `lib/telemetry/funnel/stage-sequence.ts`, wherever it belongs in the
   journey (array order is dashboard display order, not enum declaration
   order).

Nothing else needs to change — `useFunnelStageTracking` dispatches whatever
`resolveStageFromRoute` resolves, the ingestion endpoint and aggregation
query are generic over the `stage` value, and the dashboard renders
whatever `FUNNEL_STAGE_SEQUENCE` lists (a stage with zero sessions in the
selected range just shows `0`, it isn't hidden).

## Access gating

Two independent gates, matching the acceptance criteria:

1. **Route-level feature flag**: the page calls `notFound()` unless
   `NEXT_PUBLIC_INTERNAL_DASHBOARD_ENABLED=true`, so it isn't reachable at
   all in a deployment that hasn't opted in.
2. **Backend role check**: `GET /analytics/funnel/summary` requires an
   authenticated user with the `ADMIN` role (`JwtAuthGuard` + `RolesGuard`).
   This is the actual security boundary — the frontend flag is a
   deployment switch, not access control, since a client-side check alone
   can always be bypassed.

## Known simplifications

- `navigation_method` on every dispatched event reads as `direct_url` — a
  plain pathname watcher can't distinguish a nav-item click from a typed
  URL. Call `telemetry.track('funnel_stage_entered', ...)` directly with a
  more specific value from a click handler if that distinction matters for
  a specific stage.
- `interactions_count`/`bounce` on `funnel_stage_exited` always read `0`/
  `true` — in-stage interaction instrumentation
  (`lib/telemetry/ui/element-tracker.ts`) isn't wired into the tracking
  hook. The dashboard doesn't consume either field today.
- The USD-style "drop-off %" shown per stage compares each stage's distinct
  session count to the *previous stage in `FUNNEL_STAGE_SEQUENCE`*, not to
  the funnel's first stage — this matches "step-by-step drop-off," not
  overall conversion rate.
