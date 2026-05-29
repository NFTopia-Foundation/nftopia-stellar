// Tracks form field friction and submission events

import { DeviceType, FormFieldInteractionPayload, FormSubmissionAttemptPayload, FormSubmissionSuccessPayload } from "./types";

export function trackFormFieldInteraction(payload: FormFieldInteractionPayload) {
  if (!process.env.NEXT_PUBLIC_UI_TELEMETRY_ENABLED) return;
  // TODO: Sanitize payload
  // TODO: Emit telemetry event (e.g., telemetry.track('form_field_interaction', payload))
}

export function trackFormSubmissionAttempt(payload: FormSubmissionAttemptPayload) {
  if (!process.env.NEXT_PUBLIC_UI_TELEMETRY_ENABLED) return;
  // TODO: Sanitize payload
  // TODO: Emit telemetry event (e.g., telemetry.track('form_submission_attempt', payload))
}

export function trackFormSubmissionSuccess(payload: FormSubmissionSuccessPayload) {
  if (!process.env.NEXT_PUBLIC_UI_TELEMETRY_ENABLED) return;
  // TODO: Sanitize payload
  // TODO: Emit telemetry event (e.g., telemetry.track('form_submission_success', payload))
}
