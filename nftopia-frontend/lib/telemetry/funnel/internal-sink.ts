import { API_CONFIG } from "@/lib/config";
import type { EnrichedTelemetryEvent } from "../context/types";

/**
 * Funnel events (#662) are the one category that also needs to land in
 * *our own* database — PostHog/GA4 (the main `adapter` in client.ts) can't
 * back an internal dashboard without leaving the codebase for their UI,
 * which is the exact problem #662 exists to fix. This is a side-channel,
 * independent of whichever main provider is configured (or even if
 * telemetry is disabled entirely): best-effort, fire-and-forget, and never
 * throws into the caller.
 */
const FUNNEL_EVENT_PREFIX = "funnel_";

export function isFunnelEvent(eventName: string): boolean {
  return eventName.startsWith(FUNNEL_EVENT_PREFIX);
}

export function sendToInternalSink(
  eventName: string,
  enriched: EnrichedTelemetryEvent<Record<string, unknown>>,
): void {
  if (!isFunnelEvent(eventName)) return;
  if (typeof fetch === "undefined") return;

  try {
    fetch(`${API_CONFIG.baseUrl}/api/v1/analytics/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventName,
        context: enriched.context,
        payload: enriched.payload,
      }),
      keepalive: true,
    }).catch(() => {
      // Best-effort — a dropped funnel event just means a slightly
      // undercounted dashboard, never a broken page.
    });
  } catch {
    // Same as above; fetch() itself can throw synchronously in some
    // environments (e.g. a CSP violation).
  }
}
