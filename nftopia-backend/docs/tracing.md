# Distributed tracing (OpenTelemetry)

The backend exports OpenTelemetry traces so a single user request can be followed across the REST/GraphQL layer, Postgres, Redis, and Horizon/Soroban RPC calls, instead of only being visible as separate, uncorrelated log lines.

## How it's wired up

- `src/tracing.ts` starts the OpenTelemetry Node SDK. It's imported as the very first statement in `src/main.ts`, before `AppModule` — auto-instrumentation works by patching a module (`pg`, `ioredis`, `http`, `undici`) the first time it's `require`d, so it has to run before anything else loads those modules.
- Auto-instrumentation covers:
  - `http`/`https` (incoming REST/GraphQL requests) and Express
  - `undici`, which backs Node's global `fetch` — this is what `soroban-rpc.service.ts`'s Horizon calls actually run on; `instrumentation-http` alone does not see `fetch` traffic
  - `pg` (Postgres, via TypeORM)
  - `ioredis`
  - NestJS internals (controllers, guards, interceptors, pipes), so a trace shows where in the request pipeline time went
- Manual spans wrap `retrySorobanRpcCall` in `src/services/soroban-rpc.service.ts` — every real Soroban/Horizon RPC call in the codebase (`getAccount`, `simulateTransaction`, `sendTransaction`, ...) routes through this one function via `SorobanRpcService.retryRpcCall`, so instrumenting it once captures blockchain RPC latency everywhere, with attributes for the RPC method, attempt count, and (on failure) the error. `src/services/stellar-account.service.ts`'s response-shaping methods also get a span each, though that service makes no network calls itself — it's a pure transform step, so its span shows transform overhead as a named child span rather than RPC time.
- `src/config/tracing.config.ts` resolves configuration from environment variables (see below), as a plain function kept separate from SDK startup so it's unit-testable without booting OpenTelemetry.
- `src/config/logger.config.ts` stamps every Pino log line emitted while a span is active with that span's `traceId`/`spanId`, alongside the existing `requestId` correlation ID. A trace ID from a log line can be pasted into the trace backend's search box, and vice versa.

## Configuration

Set in `.env` (see `.env.example` for the full list with defaults):

| Variable | Default | Purpose |
| --- | --- | --- |
| `OTEL_ENABLED` | `true` outside `NODE_ENV=test`, otherwise `false` | Master on/off switch. Disabled under tests so Jest never boots exporters/instrumentation or waits on a collector that isn't running. |
| `OTEL_SERVICE_NAME` | `nftopia-backend` | Service name attached to every span, as it appears in the trace backend. |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://localhost:4318/v1/traces` | Where spans are exported to, via OTLP/HTTP. |
| `OTEL_TRACES_SAMPLE_RATIO` | `1` outside production, `0.2` in production | Fraction of root traces sampled, `0`–`1`. A trace's sampling decision is made once at its root span and inherited by every child (`ParentBasedSampler`), so a trace is never split between sampled and unsampled spans. Lower this in production if the exporter/collector becomes a bottleneck under load; raise it (up to `1`) when you need full visibility to debug something specific. |

## Viewing traces locally

`docker-compose.yml` includes a `jaeger` service (`jaegertracing/all-in-one`) that accepts OTLP traces directly — no separate collector needed for local development.

```bash
docker compose up jaeger
# or `docker compose up` to start the full stack, backend included
```

Then:

1. Open the Jaeger UI at **http://localhost:16686**.
2. Make a request that exercises HTTP → Postgres/Redis → a Soroban RPC call (e.g. an endpoint that reads a listing and checks the on-chain balance).
3. In Jaeger, select the `nftopia-backend` service and click **Find Traces**. The request shows up as a single trace with nested spans for each layer it touched.

If you're running the backend outside Docker (`npm run start:dev`) against a Jaeger container started separately, `OTEL_EXPORTER_OTLP_ENDPOINT` should point at `http://localhost:4318/v1/traces` (the default already assumes this).

### Cross-referencing a slow/failed request

1. Find the request's `requestId` or `traceId` in the logs (both are on every log line emitted during that request).
2. Paste the `traceId` into Jaeger's search to jump straight to that request's trace, or grep the logs for a `traceId` you found in Jaeger.

## Local sanity check without Jaeger

To confirm the SDK is exporting anything at all without standing up a full trace backend, point `OTEL_EXPORTER_OTLP_ENDPOINT` at a throwaway listener, or temporarily swap `docs/tracing.md`'s Jaeger step for `docker run -p 4318:4318 otel/opentelemetry-collector` with a `logging` exporter in its config — the collector's stdout will show each received span. This isn't wired up by default since Jaeger's UI is more useful day-to-day.
