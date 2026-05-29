// Tracks UI element visibility and interaction events

import { DeviceType, ViewportPosition, UIElementViewedPayload, UIElementInteractedPayload } from "./types";
import { telemetry } from "../index";
import { sanitizeTelemetryPayload } from "../sanitizer";


export function trackUIElementViewed(payload: UIElementViewedPayload) {
  if (!process.env.NEXT_PUBLIC_UI_TELEMETRY_ENABLED) return;
  const sanitized = sanitizeTelemetryPayload(payload);
  telemetry.track("ui_element_viewed", sanitized);
}


export function trackUIElementInteracted(payload: UIElementInteractedPayload) {
  if (!process.env.NEXT_PUBLIC_UI_TELEMETRY_ENABLED) return;
  const sanitized = sanitizeTelemetryPayload(payload);
  telemetry.track("ui_element_interacted", sanitized);
}
