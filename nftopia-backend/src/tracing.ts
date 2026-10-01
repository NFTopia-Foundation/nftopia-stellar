// -------------------------------------------------------------------------
// OpenTelemetry bootstrap (#534). Imported as the very first statement in
// main.ts — before AppModule (and therefore before TypeORM/pg, ioredis, and
// any HTTP client) is loaded — because auto-instrumentation works by
// monkey-patching a module the first time it's required. Registering the
// SDK after those modules are already loaded elsewhere would silently miss
// them.
//
// See docs/tracing.md for how to view traces locally during development.
// -------------------------------------------------------------------------
import { NodeSDK } from '@opentelemetry/sdk-node';
import {
  ParentBasedSampler,
  TraceIdRatioBasedSampler,
} from '@opentelemetry/sdk-trace-base';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { IORedisInstrumentation } from '@opentelemetry/instrumentation-ioredis';
import { UndiciInstrumentation } from '@opentelemetry/instrumentation-undici';
import { NestInstrumentation } from '@opentelemetry/instrumentation-nestjs-core';
import {
  getTracingConfig,
  tracingEnvironmentFromProcessEnv,
} from './config/tracing.config';

const config = getTracingConfig(tracingEnvironmentFromProcessEnv());

let sdk: NodeSDK | undefined;

if (config.enabled) {
  sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: config.serviceName,
      [ATTR_SERVICE_VERSION]: config.serviceVersion,
    }),
    traceExporter: new OTLPTraceExporter({ url: config.otlpEndpoint }),
    // Sampling decision is made once at the root span and inherited by
    // every child span in the trace (ParentBasedSampler), so a trace is
    // never split between "sampled" and "unsampled" spans.
    sampler: new ParentBasedSampler({
      root: new TraceIdRatioBasedSampler(config.sampleRatio),
    }),
    instrumentations: [
      // Node's core http/https — incoming requests to the REST/GraphQL
      // gateways, and any outbound call still made via http/https directly.
      new HttpInstrumentation(),
      new ExpressInstrumentation(),
      // Undici backs Node's global `fetch`, which is what
      // soroban-rpc.service.ts's Horizon health check (and anything else
      // using `fetch`) actually runs on — instrumentation-http alone does
      // not see these calls.
      new UndiciInstrumentation(),
      new PgInstrumentation(),
      new IORedisInstrumentation(),
      // Adds NestJS-specific spans (controllers, guards, interceptors,
      // pipes) so a trace shows *where in the request pipeline* time went,
      // not just "an HTTP request happened".
      new NestInstrumentation(),
    ],
  });

  sdk.start();

  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.on(signal, () => {
      sdk
        ?.shutdown()
        .catch((err) =>
          console.error('Error shutting down OpenTelemetry SDK', err),
        )
        .finally(() => process.exit(0));
    });
  }
}

export { config as tracingConfig };
