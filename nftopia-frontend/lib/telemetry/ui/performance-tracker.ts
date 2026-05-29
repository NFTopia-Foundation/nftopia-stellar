// Tracks layout variant rendering and performance

import { DeviceType, LayoutVariantRenderedPayload, AccessibilityInteractionPayload } from "./types";
import { telemetry } from "../index";
import { sanitizeTelemetryPayload } from "../sanitizer";

export function trackLayoutVariantRendered(payload: LayoutVariantRenderedPayload) {
  if (!process.env.NEXT_PUBLIC_UI_TELEMETRY_ENABLED) return;
  const sanitized = sanitizeTelemetryPayload(payload);
  telemetry.track("layout_variant_rendered", sanitized);
}

export function trackAccessibilityInteraction(payload: AccessibilityInteractionPayload) {
  if (!process.env.NEXT_PUBLIC_UI_TELEMETRY_ENABLED) return;
  const sanitized = sanitizeTelemetryPayload(payload);
  telemetry.track("accessibility_interaction", sanitized);
}
