"use client";
import { useEffect } from "react";
import { telemetry } from "../lib/telemetry";

/**
 * React hook to initialize telemetry at app bootstrap.
 * Ensures telemetry is ready early and only initialized once.
 */
export function useTelemetry() {
  useEffect(() => {
    telemetry.init();
    // No cleanup needed; telemetry is singleton and idempotent
  }, []);
}
