// Tracks scroll depth milestones

import { DeviceType, ScrollDepthTrackedPayload } from "./types";
import { telemetry } from "../index";
import { sanitizeTelemetryPayload } from "../sanitizer";


export function trackScrollDepth(payload: ScrollDepthTrackedPayload) {
  if (!process.env.NEXT_PUBLIC_UI_TELEMETRY_ENABLED) return;
  const sanitized = sanitizeTelemetryPayload(payload);
  telemetry.track("scroll_depth_tracked", sanitized);
}
