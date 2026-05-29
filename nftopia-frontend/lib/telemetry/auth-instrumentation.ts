import { telemetry } from "./index";
import { EVENT_NAMES, TelemetryEventName } from "./events";
import { TelemetryPayload } from "./types";
import { mapAuthErrorToCode, AuthErrorCode } from "./auth-error-codes";

export function generateAttemptId(): string {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
  );
}

export function nowMs(): number {
  return typeof performance !== "undefined" && performance.now
    ? performance.now()
    : Date.now();
}

export function emitAuthEvent<T extends TelemetryEventName>(
  eventName: T,
  payload: TelemetryPayload<T>
) {
  try {
    telemetry.track(eventName, payload);
  } catch {
    // Never block auth UX
  }
}

// Ownership: page emits submit, hooks/stores emit terminal events
export const authInstrumentation = {
  submitLogin({ auth_method, surface }: { auth_method: "email" | "wallet"; surface: "login_page"; }) {
    const attempt_id = generateAttemptId();
    emitAuthEvent(EVENT_NAMES.authLoginSubmitted, { auth_method, surface, attempt_id });
    return attempt_id;
  },
  loginSuccess({ auth_method, attempt_id, startMs, had_wallet_connected }: { auth_method: "email" | "wallet"; attempt_id: string; startMs: number; had_wallet_connected: boolean; }) {
    const latency_ms = Math.round(nowMs() - startMs);
    emitAuthEvent(EVENT_NAMES.authLoginSucceeded, { auth_method, latency_ms, attempt_id, had_wallet_connected });
  },
  loginFailed({ auth_method, attempt_id, startMs, error, failure_stage, validation_error_count }: { auth_method: "email" | "wallet"; attempt_id: string; startMs: number; error: unknown; failure_stage: "validation" | "request" | "response" | "state_sync"; validation_error_count?: number; }) {
    const latency_ms = Math.round(nowMs() - startMs);
    const error_code = mapAuthErrorToCode(error);
    emitAuthEvent(EVENT_NAMES.authLoginFailed, { auth_method, attempt_id, latency_ms, error_code, failure_stage, validation_error_count });
  },
  submitRegister({ auth_method, surface, has_optional_username, has_connected_wallet }: { auth_method: "email" | "wallet"; surface: "register_page"; has_optional_username: boolean; has_connected_wallet: boolean; }) {
    const attempt_id = generateAttemptId();
    emitAuthEvent(EVENT_NAMES.authRegisterSubmitted, { auth_method, surface, attempt_id, has_optional_username, has_connected_wallet });
    return attempt_id;
  },
  registerSuccess({ auth_method, attempt_id, startMs, redirects_to_login }: { auth_method: "email" | "wallet"; attempt_id: string; startMs: number; redirects_to_login: boolean; }) {
    const latency_ms = Math.round(nowMs() - startMs);
    emitAuthEvent(EVENT_NAMES.authRegisterSucceeded, { auth_method, attempt_id, latency_ms, redirects_to_login });
  },
  registerFailed({ auth_method, attempt_id, startMs, error, failure_stage, validation_error_count }: { auth_method: "email" | "wallet"; attempt_id: string; startMs: number; error: unknown; failure_stage: "validation" | "csrf" | "request" | "response"; validation_error_count?: number; }) {
    const latency_ms = Math.round(nowMs() - startMs);
    const error_code = mapAuthErrorToCode(error);
    emitAuthEvent(EVENT_NAMES.authRegisterFailed, { auth_method, attempt_id, latency_ms, error_code, failure_stage, validation_error_count });
  },
};
