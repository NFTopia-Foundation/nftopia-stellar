// Tracks scroll depth milestones

import { DeviceType, ScrollDepthTrackedPayload } from "./types";

export function trackScrollDepth(payload: ScrollDepthTrackedPayload) {
  if (!process.env.NEXT_PUBLIC_UI_TELEMETRY_ENABLED) return;
  // TODO: Sanitize payload
  // TODO: Emit telemetry event (e.g., telemetry.track('scroll_depth_tracked', payload))
}
