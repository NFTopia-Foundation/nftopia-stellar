# MongoDB for Analytics/Event Data (#531)

This document describes the MongoDB integration provisioned for flexible,
schema-light analytics/event storage, kept separate from the relational
Postgres schema.

---

## 1. Why a separate database

Postgres (via TypeORM) remains the system of record for everything
relational: users, NFTs, listings, orders, auctions, etc. Analytics/event
data doesn't fit that model well:

- **Event shapes vary and evolve per event name.** nftopia-frontend's
  telemetry catalog (`nftopia-frontend/lib/telemetry/types.ts`) already
  defines dozens of distinct payload shapes (`wallet_connect_succeeded`,
  `mint_nft_failed`, `listing_create_submitted`, ...), each with different
  fields. Modeling that relationally means either a wide table of mostly-
  null columns, or a migration every time a new event or field is added.
- **Write volume and access patterns differ.** Event data is
  write-heavy, append-only, and queried very differently (by event name,
  by time range, by session) from the transactional reads/writes the
  relational schema serves.
- **Retention is time-based, not row-based.** Analytics events age out on
  a fixed schedule (see §4) — a TTL index is a natural fit for MongoDB and
  an awkward one for Postgres.

MongoDB is provisioned specifically for this: a document store that can
absorb whatever shape an event needs without a schema migration, with the
relational database untouched.

---

## 2. Connection configuration

Resolved by `src/config/mongo.config.ts` (`getMongoConfig`), wired into
`AppModule` via `MongooseModule.forRootAsync`. Skipped entirely under
`NODE_ENV=test` — same convention as the existing `TypeOrmModule`
registration — so the Jest suite never tries to hold the process open
waiting on a real connection.

| Environment Variable                  | Default                    | Description |
|----------------------------------------|-----------------------------|--------------|
| `MONGO_URI`                            | `mongodb://localhost:27017` | Connection string. |
| `MONGO_DB_NAME`                        | `nftopia_analytics`         | Database name. |
| `MONGO_RETRY_ATTEMPTS`                 | `10`                        | Connection attempts NestJS retries on startup before giving up. |
| `MONGO_RETRY_DELAY_MS`                 | `3000`                      | Delay (ms) between retry attempts. |
| `MONGO_CONNECT_TIMEOUT_MS`             | `10000`                     | Mongoose/driver `connectTimeoutMS`. |
| `MONGO_SERVER_SELECTION_TIMEOUT_MS`    | `10000`                     | Mongoose/driver `serverSelectionTimeoutMS`. |

### Retry/backoff

`retryAttempts`/`retryDelay` are NestJS's own built-in connection retry
for `MongooseModule.forRootAsync` (the same mechanism `TypeOrmModule` uses
for Postgres): if the initial connection attempt fails — e.g. Mongo isn't
up yet during a coordinated `docker-compose up` — Nest retries up to
`MONGO_RETRY_ATTEMPTS` times, waiting `MONGO_RETRY_DELAY_MS` between each,
before failing application startup. This is a fixed delay between
attempts, not exponential backoff; the defaults (10 attempts × 3s = up to
30s of tolerance) are generous enough for local/CI startup races without
needing anything more elaborate.

### Package versions — a deliberate pin

`@nestjs/mongoose` is pinned to `^11.0.4`, not the latest `12.x`. Version
12 shipped as ESM-only (`"type": "module"`, no CommonJS build), which
fails to load under this project's CommonJS/ts-jest setup
(`SyntaxError: Unexpected token 'export'` when Jest tries to `require()`
it). `mongoose` itself is pinned to `^8.19.0` rather than `9.x` for a
related reason: `mongoose@9` bundles a `mongodb` driver version that fails
its handshake against the `mongod` binary used in this repo's integration
test (`Missing required sub-document 'driver' in the client metadata
document`) — `mongoose@8`'s bundled driver (`mongodb@~6.20`) does not have
this problem, and matches the driver version `typeorm`'s own MongoDB
support already depends on elsewhere in this repo.

---

## 3. Schema: `analytics_events`

Defined in `src/modules/analytics/schemas/analytics-event.schema.ts`,
registered via `AnalyticsModule` (`src/modules/analytics/`).

```ts
{
  eventName: string;          // required, indexed
  context: {                  // required
    timestamp: string;        // ISO-8601, client clock
    route: string;
    locale: string;
    sessionId: string;        // indexed
    deviceType: string;
    appSurface: string;
    anonymousId?: string;
    userId?: string;          // indexed
    referrerRoute?: string;
  };
  payload: Record<string, unknown>;  // Mixed — shape varies by eventName
  receivedAt: Date;           // required, server-set, TTL-indexed
}
```

`context` deliberately mirrors nftopia-frontend's
`EnrichedTelemetryEvent.context` shape
(`nftopia-frontend/lib/telemetry/context/types.ts`) field-for-field. The
frontend's telemetry client (`lib/telemetry/client.ts`) already builds
exactly this envelope for every event it tracks; a future backend
ingestion endpoint (**out of scope for this issue** — see §6) can persist
what the client already sends with no translation layer.

`payload` is intentionally `Mixed` (untyped at the database level): each
event name carries a different shape (see
`nftopia-frontend/lib/telemetry/types.ts`'s `TelemetryPayloadMap`), and
enforcing a rigid schema here would reintroduce the exact problem
MongoDB was chosen to avoid (§1).

`receivedAt` is set server-side on write (`AnalyticsEventService.record`
never trusts a caller-supplied ingestion time) and is distinct from
`context.timestamp`, which is client-clock and untrusted — the gap
between the two is potentially useful for detecting delivery lag or clock
skew, though nothing currently consumes it for that.

### Access

`AnalyticsEventService` (`src/modules/analytics/analytics-event.service.ts`)
is the only way to read/write this collection:

- `record(input)` — persists one event.
- `findRecentByEventName(eventName, limit = 20)` — most recent events for
  a given event name, newest first.

---

## 4. Retention policy

**90 days**, enforced by a MongoDB TTL index on `receivedAt`
(`ANALYTICS_EVENT_RETENTION_DAYS` in `analytics-event.schema.ts`).
MongoDB's TTL monitor runs roughly every 60 seconds and deletes any
document whose `receivedAt` is more than 90 days in the past — no
application-level cron job or manual pruning is needed.

### Changing the retention window

A TTL index's expiry is fixed at index-creation time — editing
`ANALYTICS_EVENT_RETENTION_DAYS` in code changes what index Mongoose
*declares* for new deployments, but does **not** retroactively alter an
index that already exists in a running database. To change retention on
an existing deployment, rebuild the index with the new value, e.g.:

```js
db.analytics_events.collMod('analytics_events', {
  index: {
    keyPattern: { receivedAt: 1 },
    expireAfterSeconds: <new value in seconds>,
  },
});
```

This is a deliberate minimal-scope decision: 90 days is a reasonable
default for event/analytics data (long enough for typical
trend/funnel analysis, short enough to bound collection growth), and an
env-var-driven "self-updating" TTL was intentionally not built — it would
need this same `collMod` step behind the scenes to actually take effect,
which is more moving parts than this issue's initial schema warrants.

---

## 5. Health check

`GET /health/ready` reports MongoDB connectivity in `details.mongodb`
(`up` / `down`), alongside the existing `postgres` and `redis` checks
(`src/health/health.service.ts`'s `checkMongo`).

**MongoDB is reported but does not gate overall readiness.** Postgres and
Redis are on the request-serving critical path, so either being down
fails `/health/ready` (503). MongoDB only backs the analytics/event
store — nothing on the request path depends on it — so a Mongo outage is
surfaced for observability without failing k8s readiness/liveness probes
and cycling pods over a non-critical subsystem. This mirrors how other
best-effort dependencies are already treated elsewhere in this codebase
(e.g. the collection floor-price lookup in the AI creator co-pilot: a
failure there doesn't block the primary operation).

---

## 6. Local development

`docker-compose.yml` includes a `mongodb` service (`mongo:7`, port
`27017`, with a `mongosh`-based healthcheck and a named volume for
persistence). Running `docker compose up` brings up MongoDB alongside
Postgres/Redis/Meilisearch/Jaeger with no extra steps — the `backend`
service already depends on it and receives `MONGO_URI`/`MONGO_DB_NAME`
pointed at it.

For running the backend outside docker-compose, copy the `MONGO_*`
defaults from `.env.example` (they already point at
`mongodb://localhost:27017`, matching the compose service's exposed
port).

---

## 7. Testing

- **Unit**: `src/config/mongo.config.spec.ts` covers the config resolver
  in isolation (defaults, overrides, validation) — no real connection.
  `src/modules/analytics/analytics-event.service.spec.ts` covers
  `AnalyticsEventService` against a mocked Mongoose model.
- **Integration**: `src/modules/analytics/analytics-event.integration.spec.ts`
  runs against a real, ephemeral MongoDB instance via
  `mongodb-memory-server` (no docker/external service required to run
  `npm test`) — writes a document through the real service and schema,
  reads it back via the model directly, and asserts the TTL index is
  actually declared with the documented retention window. This is real
  end-to-end coverage of the schema and service, not a mock.

## 8. Out of scope for this issue

No HTTP ingestion endpoint (e.g. `POST /analytics/events`) is added here.
The issue that provisioned this integration is about the database
connection, schema, health check, and retention policy being in place;
wiring the frontend's telemetry client (or a new backend ingestion
endpoint) to actually write through `AnalyticsEventService` is a natural
follow-up, not part of this change.
