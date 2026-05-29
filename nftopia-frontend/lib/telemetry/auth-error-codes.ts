// Stable error code mapping for auth telemetry

export type AuthErrorCode =
  | "auth_validation_missing_fields"
  | "auth_validation_invalid_email"
  | "auth_validation_password_mismatch"
  | "auth_validation_password_too_short"
  | "auth_wallet_not_connected"
  | "auth_wallet_signature_rejected"
  | "auth_wallet_provider_unavailable"
  | "auth_csrf_fetch_failed"
  | "auth_request_timeout"
  | "auth_invalid_credentials"
  | "auth_user_exists"
  | "auth_rate_limited"
  | "auth_server_unavailable"
  | "auth_unknown_error";

export function mapAuthErrorToCode(error: unknown): AuthErrorCode {
  if (!error) return "auth_unknown_error";
  if (typeof error === "string") {
    if (error.includes("missing")) return "auth_validation_missing_fields";
    if (error.includes("invalid email")) return "auth_validation_invalid_email";
    if (error.includes("password mismatch")) return "auth_validation_password_mismatch";
    if (error.includes("password too short")) return "auth_validation_password_too_short";
    if (error.includes("wallet not connected")) return "auth_wallet_not_connected";
    if (error.includes("signature rejected")) return "auth_wallet_signature_rejected";
    if (error.includes("provider unavailable")) return "auth_wallet_provider_unavailable";
    if (error.includes("csrf")) return "auth_csrf_fetch_failed";
    if (error.includes("timeout")) return "auth_request_timeout";
    if (error.includes("invalid credentials")) return "auth_invalid_credentials";
    if (error.includes("user exists")) return "auth_user_exists";
    if (error.includes("rate limit")) return "auth_rate_limited";
    if (error.includes("server unavailable")) return "auth_server_unavailable";
  }
  if (typeof error === "object" && error !== null) {
    const msg = (error as any).message || "";
    return mapAuthErrorToCode(msg);
  }
  return "auth_unknown_error";
}
