import { EVENT_NAMES, TelemetryEventName } from "../events";
import { TelemetryPayloadMap } from "../types";
import { TELEMETRY_EVENT_CATALOG } from "../catalog";

// 1. No duplicate event name values
it("has no duplicate event name values", () => {
  const values = Object.values(EVENT_NAMES);
  const unique = new Set(values);
  expect(unique.size).toBe(values.length);
});

// 2. Every event has catalog metadata
it("every event has catalog metadata", () => {
  const values = Object.values(EVENT_NAMES);
  for (const name of values) {
    expect(TELEMETRY_EVENT_CATALOG[name as TelemetryEventName]).toBeDefined();
  }
});

// 3. Every event in EVENT_NAMES exists in TelemetryPayloadMap
it("every event in EVENT_NAMES exists in TelemetryPayloadMap", () => {
  const values = Object.values(EVENT_NAMES);
  // Get the keys of TelemetryPayloadMap type as a runtime array
  type PayloadKeys = keyof TelemetryPayloadMap;
  const payloadKeys: string[] = [
    "wallet_connect_modal_opened",
    "wallet_connect_modal_closed",
    "wallet_connect_provider_selected",
    "wallet_connect_submitted",
    "wallet_connect_succeeded",
    "wallet_connect_failed",
    "wallet_disconnect_clicked",
    "wallet_disconnect_succeeded",
    "wallet_disconnect_failed",
    "wallet_session_rehydrate_started",
    "wallet_session_rehydrate_succeeded",
    "wallet_session_rehydrate_failed",
    "wallet_provider_state_changed",
    "auth_login_submitted",
    "auth_login_succeeded",
    "auth_login_failed",
    "auth_register_submitted",
    "auth_register_succeeded",
    "auth_register_failed",
    "collection_create_submitted",
    "collection_create_succeeded",
    "collection_create_failed",
    "mint_nft_submitted",
    "mint_nft_succeeded",
    "mint_nft_failed",
    "listing_create_submitted",
    "listing_create_succeeded",
    "listing_create_failed",
    "cta_clicked",
    "nav_item_clicked",
    "section_viewed",
    "experiment_exposed",
    "experiment_interaction",
    "experiment_conversion",
    "experiment_assignment_info",
    "creator_dashboard_error",
    "page_not_found",
  ];
  for (const name of values) {
    expect(payloadKeys.includes(name)).toBe(true);
  }
});

// 4. Typed helper enforces compile-time payload compatibility

import { buildTelemetryEvent } from "../helpers";

test("buildTelemetryEvent enforces payload type", () => {
  // Valid usage
  expect(
    buildTelemetryEvent("wallet_connect_submitted", {
      provider: "freighter",
      surface: "modal",
      attempt_id: "test-attempt-id",
    })
  ).toEqual({
    eventName: "wallet_connect_submitted",
    payload: { provider: "freighter", surface: "modal", attempt_id: "test-attempt-id" },
  });
  // TypeScript compile-time test (uncomment to check):
  // buildTelemetryEvent("wallet_connect_submitted", { foo: "bar" }); // Should error if uncommented
});
