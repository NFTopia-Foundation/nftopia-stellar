# Telemetry Event Taxonomy & Payload Contracts

## Overview
This module defines the canonical, type-safe event catalog and payload contracts for all telemetry in the frontend. It ensures:
- Consistent event names and payloads
- Compile-time safety for all telemetry calls
- Centralized event metadata for analytics and governance

## Event Naming Convention
- Lowercase snake_case
- Pattern: `subject_action_phase` or `subject_action_outcome`
- No camelCase, provider suffixes, or environment prefixes
- Use `failed` not `error` for outcomes

## Event Categories
- `auth`, `wallet`, `creator`, `marketplace`, `navigation`, `engagement`, `system`

## Adding a New Event
1. Add event constant in `events.ts`
2. Add payload interface in `types.ts` map
3. Add catalog metadata in `catalog.ts`
4. Add or update unit tests in `__tests__/events.test.ts`
5. Document meaning and ownership here

## File Structure
- `events.ts`: Canonical event constants and union
- `types.ts`: Payload map and type lookup
- `catalog.ts`: Metadata for every event
- `helpers.ts`: Typed helper for safe event construction
- `__tests__/events.test.ts`: Contract tests

## Versioning & Deprecation
- Each event has a version and status
- Deprecated events must be marked with replacement notes

## Example Usage
```ts
import { telemetry } from "../client";
import { EVENT_NAMES } from "./events";
import { buildTelemetryEvent } from "./helpers";

telemetry.track(
  EVENT_NAMES.walletConnectSubmitted,
  buildTelemetryEvent(EVENT_NAMES.walletConnectSubmitted, {
    provider: "freighter",
    surface: "modal"
  }).payload
);
```

## Test Coverage
- No duplicate event names
- Every event has catalog metadata
- Every event in EVENT_NAMES exists in TelemetryPayloadMap
- Typed helper enforces compile-time payload compatibility
