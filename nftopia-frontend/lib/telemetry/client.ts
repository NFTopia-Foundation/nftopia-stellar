import { getTelemetryConfig } from "./config";
import { TelemetryAdapter } from "./adapters/base";
import { noopAdapter } from "./adapters/noop";
import { posthogAdapter } from "./adapters/posthog";
import { enrichTelemetryPayload } from "./context/enricher";
import { sanitizePayload } from "./sanitize";
import { DEFAULT_RELIABILITY_CONFIG } from "./reliability/config";
import { TelemetryQueue } from "./reliability/queue";
import { TelemetryDispatcher } from "./reliability/dispatcher";
import { shouldSampleEvent } from "./reliability/sampling";
import { TelemetryDebouncer } from "./reliability/debounce";
import { v4 as uuidv4 } from "uuid";
import { sendToInternalSink } from "./funnel/internal-sink";

export interface TelemetryClient {
  init(): Promise<void>;
  track(eventName: string, payload?: Record<string, unknown>): void;
  identify(userId: string, traits?: Record<string, unknown>): void;
  reset(): void;
}

class TelemetryCore implements TelemetryClient {
  private adapter: TelemetryAdapter = noopAdapter;
  private initialized = false;
  private reliabilityConfig = DEFAULT_RELIABILITY_CONFIG;
  private queue = new TelemetryQueue(DEFAULT_RELIABILITY_CONFIG);
  private dispatcher = new TelemetryDispatcher(this.queue, DEFAULT_RELIABILITY_CONFIG);
  private debouncer = new TelemetryDebouncer(DEFAULT_RELIABILITY_CONFIG.debounceRules);

  async init() {
    if (this.initialized) return;
    const config = getTelemetryConfig();
    // Optionally, update reliabilityConfig from env here if needed
    this.reliabilityConfig = DEFAULT_RELIABILITY_CONFIG;
    this.queue = new TelemetryQueue(this.reliabilityConfig);
    this.dispatcher = new TelemetryDispatcher(this.queue, this.reliabilityConfig);
    this.debouncer = new TelemetryDebouncer(this.reliabilityConfig.debounceRules);
    try {
      await this.adapter.init();
      this.dispatcher.setAdapterReady(true);
      this.dispatcher.schedulePeriodicFlush();
    } catch (e) {
      if (config.debug) {
        // eslint-disable-next-line no-console
        console.debug("[Telemetry][Client] Adapter init failed:", e);
      }
      this.adapter = noopAdapter;
      this.dispatcher.setAdapterReady(false);
    }
    this.initialized = true;
  }

  track(eventName: string, payload?: Record<string, unknown>) {
    // Reliability disabled: fallback to direct best-effort dispatch
    if (!this.reliabilityConfig.enabled) {
      try {
        const sanitized = sanitizePayload(payload || {}, { category: this.getCategoryForEvent(eventName), debug: !!getTelemetryConfig().debug });
        const enriched = enrichTelemetryPayload(sanitized);
        this.adapter.track(eventName, enriched);
        sendToInternalSink(eventName, enriched);
      } catch (e) {
        if (getTelemetryConfig().debug) {
          // eslint-disable-next-line no-console
          console.debug("[Telemetry][Client] track error:", e);
        }
      }
      return;
    }
    // 1. Sampling
    if (!shouldSampleEvent(eventName, this.reliabilityConfig.samplingRules)) {
      if (this.reliabilityConfig.debug) {
        // eslint-disable-next-line no-console
        console.log(`[telemetry][event_sampled_out] eventName=${eventName}`);
      }
      return;
    }
    // 2. Debounce
    const debounceRule = this.debouncer.shouldDebounce(eventName);
    if (debounceRule) {
      this.debouncer.debounce(eventName, { eventName, payload }, debounceRule, (debouncedEvent) => {
        this.dispatchOrEnqueue(debouncedEvent.eventName, debouncedEvent.payload);
        if (this.reliabilityConfig.debug) {
          // eslint-disable-next-line no-console
          console.log(`[telemetry][event_debounced] eventName=${eventName}`);
        }
      });
      return;
    }
    // 3. Dispatch or enqueue
    this.dispatchOrEnqueue(eventName, payload);
  }

  private dispatchOrEnqueue(eventName: string, payload?: Record<string, unknown>) {
    const sanitized = sanitizePayload(payload || {}, { category: this.getCategoryForEvent(eventName), debug: !!this.reliabilityConfig.debug });
    const enriched = enrichTelemetryPayload(sanitized);
    sendToInternalSink(eventName, enriched);
    try {
      this.adapter.track(eventName, enriched);
      if (this.reliabilityConfig.debug) {
        // eslint-disable-next-line no-console
        console.log(`[telemetry][dispatch_success] eventName=${eventName}`);
      }
    } catch (e) {
      // On failure, enqueue for retry (queue only the payload, not the full enriched event)
      const now = Date.now();
      const event = {
        id: uuidv4(),
        eventName,
        payload: sanitized, // Only the sanitized payload, not EnrichedTelemetryEvent
        enqueuedAt: now,
        attempts: 1,
        nextRetryAt: now + this.reliabilityConfig.retry.initialDelayMs,
      };
      this.queue.enqueue(event);
      if (this.reliabilityConfig.debug) {
        // eslint-disable-next-line no-console
        console.log(`[telemetry][queue_enqueue] eventName=${eventName} attempts=1`);
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
