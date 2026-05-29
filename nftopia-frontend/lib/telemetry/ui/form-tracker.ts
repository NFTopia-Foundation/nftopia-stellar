// Tracks form field friction and submission events

import { DeviceType, FormFieldInteractionPayload, FormSubmissionAttemptPayload, FormSubmissionSuccessPayload } from "./types";
import { telemetry } from "../index";
import { sanitizeTelemetryPayload } from "../sanitizer";


export function trackFormFieldInteraction(payload: FormFieldInteractionPayload) {
  if (!process.env.NEXT_PUBLIC_UI_TELEMETRY_ENABLED) return;
  const sanitized = sanitizeTelemetryPayload(payload);
  telemetry.track("form_field_interaction", sanitized);
}


export function trackFormSubmissionAttempt(payload: FormSubmissionAttemptPayload) {
  if (!process.env.NEXT_PUBLIC_UI_TELEMETRY_ENABLED) return;
  const sanitized = sanitizeTelemetryPayload(payload);
  telemetry.track("form_submission_attempt", sanitized);
}


export function trackFormSubmissionSuccess(payload: FormSubmissionSuccessPayload) {
  if (!process.env.NEXT_PUBLIC_UI_TELEMETRY_ENABLED) return;
  const sanitized = sanitizeTelemetryPayload(payload);
  telemetry.track("form_submission_success", sanitized);
}
