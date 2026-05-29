export type TelemetryProvider = "noop" | "posthog" | "ga4";

export interface TelemetryConfig {
  enabled: boolean;
  provider: TelemetryProvider;
  debug: boolean;
}

function isTestEnv(): boolean {
  return process.env.NODE_ENV === "test";
}

function parseProvider(value?: string): TelemetryProvider {
  if (value === "posthog" || value === "ga4") return value;
  return "noop";
}

export function getTelemetryConfig(): TelemetryConfig {
  const enabled =
    process.env.NEXT_PUBLIC_TELEMETRY_ENABLED === "true" &&
    !isTestEnv();
  const provider = parseProvider(process.env.NEXT_PUBLIC_TELEMETRY_PROVIDER);
  const debug = process.env.NEXT_PUBLIC_TELEMETRY_DEBUG === "true";
  return {
    enabled,
    provider,
    debug,
  };
}
