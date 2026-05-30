// Stable error code mapping for creator flows

export type CreatorFailureStage =
  | "validation"
  | "upload"
  | "csrf"
  | "request"
  | "response"
  | "redirect"
  | "auth_guard";

export type CreatorErrorCode =
  | "creator_validation_missing_required"
  | "creator_validation_invalid_length"
  | "creator_validation_invalid_price"
  | "creator_validation_missing_media"
  | "creator_validation_missing_collection"
  | "creator_upload_failed"
  | "creator_upload_timeout"
  | "creator_csrf_fetch_failed"
  | "creator_auth_required"
  | "creator_request_timeout"
  | "creator_api_rejected"
  | "creator_server_unavailable"
  | "creator_redirect_failed"
  | "creator_unknown_error";

export function mapCreatorErrorToCode(error: any, stage: CreatorFailureStage | string): CreatorErrorCode {
  if (stage === "validation") {
    if (error?.missingRequired) return "creator_validation_missing_required";
    if (error?.invalidLength) return "creator_validation_invalid_length";
    if (error?.invalidPrice) return "creator_validation_invalid_price";
    if (error?.missingMedia) return "creator_validation_missing_media";
    if (error?.missingCollection) return "creator_validation_missing_collection";
  }
  if (stage === "upload") {
    if (error?.timeout) return "creator_upload_timeout";
    return "creator_upload_failed";
  }
  if (stage === "csrf") return "creator_csrf_fetch_failed";
  if (stage === "auth_guard") return "creator_auth_required";
  if (stage === "request") {
    if (error?.timeout) return "creator_request_timeout";
    return "creator_api_rejected";
  }
  if (stage === "response") {
    if (error?.serverUnavailable) return "creator_server_unavailable";
    return "creator_api_rejected";
  }
  if (stage === "redirect") return "creator_redirect_failed";
  return "creator_unknown_error";
}
