// Hook for tracking form field friction and submission
import { useRef } from "react";
import { trackFormFieldInteraction, trackFormSubmissionAttempt, trackFormSubmissionSuccess } from "../lib/telemetry/ui/form-tracker";
import { DeviceType } from "../lib/telemetry/ui/types";

export function useFormTracking(formName: string, deviceType: DeviceType) {
  const fieldState = useRef<Record<string, { keystrokes: number; focusTime: number; blurTime: number; validationErrors: number }>>({});
  const submissionId = useRef<string>("");
  const attemptCount = useRef<number>(0);

  function onFieldFocus(field: string) {
    fieldState.current[field] = fieldState.current[field] || { keystrokes: 0, focusTime: Date.now(), blurTime: 0, validationErrors: 0 };
    fieldState.current[field].focusTime = Date.now();
  }

  function onFieldBlur(field: string, validationErrors: number) {
    const state = fieldState.current[field];
    if (!state) return;
    state.blurTime = Date.now();
    state.validationErrors = validationErrors;
    trackFormFieldInteraction({
      form: formName,
      field,
      keystrokeCount: state.keystrokes,
      validationErrors: state.validationErrors,
      timeInFieldMs: state.blurTime - state.focusTime,
      deviceType,
      timestamp: Date.now(),
    });
    state.keystrokes = 0;
  }

  function onFieldKeystroke(field: string) {
    fieldState.current[field] = fieldState.current[field] || { keystrokes: 0, focusTime: Date.now(), blurTime: 0, validationErrors: 0 };
    fieldState.current[field].keystrokes += 1;
  }

  function onFormSubmit(fieldCount: number, validationErrors: number) {
    submissionId.current = `${formName}_${Date.now()}`;
    attemptCount.current += 1;
    trackFormSubmissionAttempt({
      form: formName,
      fieldCount,
      validationErrors,
      deviceType,
      submissionId: submissionId.current,
      timestamp: Date.now(),
    });
  }

  function onFormSuccess(latencyMs: number) {
    trackFormSubmissionSuccess({
      form: formName,
      submissionId: submissionId.current,
      latencyMs,
      attemptCount: attemptCount.current,
      deviceType,
      timestamp: Date.now(),
    });
  }

  return {
    onFieldFocus,
    onFieldBlur,
    onFieldKeystroke,
    onFormSubmit,
    onFormSuccess,
  };
}
