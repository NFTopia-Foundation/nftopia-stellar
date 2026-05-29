// Tracks UI element visibility and interaction events

import { DeviceType, ViewportPosition, UIElementViewedPayload, UIElementInteractedPayload } from "./types";

export function trackUIElementViewed(payload: UIElementViewedPayload) {
  if (!process.env.NEXT_PUBLIC_UI_TELEMETRY_ENABLED) return;
  // TODO: Sanitize payload
  // TODO: Emit telemetry event (e.g., telemetry.track('ui_element_viewed', payload))
}

export function trackUIElementInteracted(payload: UIElementInteractedPayload) {
  if (!process.env.NEXT_PUBLIC_UI_TELEMETRY_ENABLED) return;
  // TODO: Sanitize payload
  // TODO: Emit telemetry event (e.g., telemetry.track('ui_element_interacted', payload))
}
