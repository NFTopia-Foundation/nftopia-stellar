import { TelemetryEventName } from "./events";
import { TelemetryPayload } from "./types";

/**
 * Type-safe event builder utility for compile-time safety.
 */
export function buildTelemetryEvent<T extends TelemetryEventName>(
  eventName: T,
  payload: TelemetryPayload<T>
): { eventName: T; payload: TelemetryPayload<T> } {
  return { eventName, payload };
}
