/**
 * Config resolution for OpenTelemetry tracing (#534). Kept as a pure
 * function over an env-like object — same convention as cors.config.ts /
 * stellar.config.ts — so it's cheap to unit test without booting the SDK.
 */
export interface TracingEnvironment {
  nodeEnv?: string;
  otelEnabled?: string;
  otelServiceName?: string;
  otelExporterOtlpEndpoint?: string;
  otelTracesSampleRatio?: string;
}

export interface TracingConfig {
  /** Whether the SDK should be started at all. Defaults to true outside test. */
  enabled: boolean;
  serviceName: string;
  serviceVersion: string;
  /** OTLP/HTTP traces endpoint, e.g. http://localhost:4318/v1/traces. */
  otlpEndpoint: string;
  /**
   * Fraction of root traces to sample, in [0, 1]. 1 = trace everything
   * (fine for local dev / low traffic), lower values reduce exporter and
   * collector load under production traffic. Configurable via
   * OTEL_TRACES_SAMPLE_RATIO rather than hardcoded so it can be tuned per
   * environment without a code change.
   */
  sampleRatio: number;
}

const DEFAULT_OTLP_ENDPOINT = 'http://localhost:4318/v1/traces';
const DEFAULT_SERVICE_NAME = 'nftopia-backend';

function resolveSampleRatio(raw: string | undefined, nodeEnv: string): number {
  if (raw === undefined || raw.trim() === '') {
    // Trace everything by default outside production, where the volume of
    // manual inspection during development benefits from completeness more
    // than it costs in overhead. In production, a lower default protects
    // against the exporter/collector becoming the bottleneck under load —
    // still fully overridable via OTEL_TRACES_SAMPLE_RATIO.
    return nodeEnv === 'production' ? 0.2 : 1;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    throw new Error(
      `OTEL_TRACES_SAMPLE_RATIO must be a number between 0 and 1, got: ${raw}`,
    );
  }
  return parsed;
}

export function getTracingConfig(
  env: TracingEnvironment,
  serviceVersion = process.env.npm_package_version || '0.0.0',
): TracingConfig {
  const nodeEnv = env.nodeEnv || 'development';

  return {
    // Disabled by default under test so the Jest suite never tries to spin
    // up exporters/instrumentation or hold the process open waiting on a
    // collector that isn't there.
    enabled: env.otelEnabled ? env.otelEnabled === 'true' : nodeEnv !== 'test',
    serviceName: env.otelServiceName || DEFAULT_SERVICE_NAME,
    serviceVersion,
    otlpEndpoint: env.otelExporterOtlpEndpoint || DEFAULT_OTLP_ENDPOINT,
    sampleRatio: resolveSampleRatio(env.otelTracesSampleRatio, nodeEnv),
  };
}

export function tracingEnvironmentFromProcessEnv(
  env: NodeJS.ProcessEnv = process.env,
): TracingEnvironment {
  return {
    nodeEnv: env.NODE_ENV,
    otelEnabled: env.OTEL_ENABLED,
    otelServiceName: env.OTEL_SERVICE_NAME,
    otelExporterOtlpEndpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT,
    otelTracesSampleRatio: env.OTEL_TRACES_SAMPLE_RATIO,
  };
}
