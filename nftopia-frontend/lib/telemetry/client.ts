import { getTelemetryConfig } from "./config";
import { TelemetryAdapter } from "./adapters/base";
import { noopAdapter } from "./adapters/noop";
import { posthogAdapter } from "./adapters/posthog";
import { enrichTelemetryPayload } from "./context/enricher";
import { sanitizePayload } from "./sanitize";

export interface TelemetryClient {
  init(): Promise<void>;
  track(eventName: string, payload?: Record<string, unknown>): void;
  identify(userId: string, traits?: Record<string, unknown>): void;
  reset(): void;
}

class TelemetryCore implements TelemetryClient {
  private adapter: TelemetryAdapter = noopAdapter;
  private initialized = false;

  async init() {
    if (this.initialized) return;
    const config = getTelemetryConfig();
    if (!config.enabled) {
      this.adapter = noopAdapter;
    } else {
      switch (config.provider) {
        case "posthog":
          this.adapter = posthogAdapter;
          break;
        case "ga4":
          // Placeholder for future GA4 adapter
          this.adapter = noopAdapter;
          break;
        default:
          this.adapter = noopAdapter;
      }
    }
    try {
      await this.adapter.init();
    } catch (e) {
      if (config.debug) {
        // eslint-disable-next-line no-console
        console.debug("[Telemetry][Client] Adapter init failed:", e);
      }
      this.adapter = noopAdapter;
    }
    this.initialized = true;
  }

  track(eventName: string, payload?: Record<string, unknown>) {
    try {
      // Sanitize event payload before enrichment
      const sanitized = sanitizePayload(payload || {}, { category: this.getCategoryForEvent(eventName), debug: !!getTelemetryConfig().debug });
      // Enrich sanitized payload with context
      const enriched = enrichTelemetryPayload(sanitized);
      this.adapter.track(eventName, enriched);
    } catch (e) {
      if (getTelemetryConfig().debug) {
        // eslint-disable-next-line no-console
        console.debug("[Telemetry][Client] track error:", e);
      }
    }
  }

  // Helper to map eventName to category for allowlist
  private getCategoryForEvent(eventName: string): string {
    // Simple mapping: eventName prefix before '_' is category
    const prefix = eventName.split('_')[0];
    // Fallback to empty string if not found
    return prefix || "";
  }

  identify(userId: string, traits?: Record<string, unknown>) {
    try {
      this.adapter.identify(userId, traits);
    } catch (e) {
      if (getTelemetryConfig().debug) {
        // eslint-disable-next-line no-console
        console.debug("[Telemetry][Client] identify error:", e);
      }
    }
  }

  reset() {
    try {
      this.adapter.reset();
    } catch (e) {
      if (getTelemetryConfig().debug) {
        // eslint-disable-next-line no-console
        console.debug("[Telemetry][Client] reset error:", e);
      }
    }
  }
}

export const telemetry: TelemetryClient = new TelemetryCore();
