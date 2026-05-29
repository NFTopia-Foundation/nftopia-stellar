import { TelemetryAdapter } from "./base";
import { getTelemetryConfig } from "../config";

// Placeholder for PostHog SDK type
type PostHogType = {
  init: (key: string, options?: Record<string, unknown>) => void;
  capture: (event: string, payload?: Record<string, unknown>) => void;
  identify: (userId: string, traits?: Record<string, unknown>) => void;
  reset: () => void;
};

let posthog: PostHogType | null = null;
let initialized = false;

function safe(fn: () => void) {
  try {
    fn();
  } catch (e) {
    if (getTelemetryConfig().debug) {
      // eslint-disable-next-line no-console
      console.debug("[Telemetry][PostHog] Error:", e);
    }
  }
}

export const posthogAdapter: TelemetryAdapter = {
  async init() {
    if (initialized) return;
    const config = getTelemetryConfig();
    if (!config.enabled || config.provider !== "posthog") return;
    // Lazy import PostHog SDK
    try {
      // @ts-ignore
      const mod = await import("posthog-js");
      posthog = mod.default || mod;
      if (posthog) {
        posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY || "");
      }
      initialized = true;
    } catch (e) {
      if (config.debug) {
        // eslint-disable-next-line no-console
        console.debug("[Telemetry][PostHog] SDK load failed:", e);
      }
    }
  },
  track(eventName, payload) {
    if (!initialized || !posthog) return;
    safe(() => posthog!.capture(eventName, payload));
  },
  identify(userId, traits) {
    if (!initialized || !posthog) return;
    safe(() => posthog!.identify(userId, traits));
  },
  reset() {
    if (!initialized || !posthog) return;
    safe(() => posthog!.reset());
  },
};
