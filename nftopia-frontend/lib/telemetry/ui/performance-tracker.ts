// Tracks layout variant rendering and performance

import { DeviceType, LayoutVariantRenderedPayload } from "./types";

export function trackLayoutVariantRendered(payload: LayoutVariantRenderedPayload) {
  if (!process.env.NEXT_PUBLIC_UI_TELEMETRY_ENABLED) return;
  // TODO: Sanitize payload
  // TODO: Emit telemetry event (e.g., telemetry.track('layout_variant_rendered', payload))
}
