/**
 * Shared constants for the GDPR data-export and right-to-erasure features.
 *
 * Keeping these in one place makes the policy (how long the grace period is,
 * how many exports a user may request per day, …) explicit and testable.
 */

/** Bull queue that processes large, asynchronous data-export jobs. */
export const DATA_EXPORT_QUEUE = 'data-export';

/** Job name enqueued on {@link DATA_EXPORT_QUEUE}. */
export const DATA_EXPORT_JOB = 'export-user-data';

/** Maximum number of export requests (sync or async) per rolling window. */
export const EXPORT_RATE_LIMIT_MAX = 3;

/** Rolling window for the export rate limit (24 hours). */
export const EXPORT_RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Maximum number of deletion requests per rolling window. */
export const DELETION_RATE_LIMIT_MAX = 1;

/** Rolling window for the deletion rate limit (30 days). */
export const DELETION_RATE_LIMIT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/** Grace period between a verified deletion request and erasure. */
export const DELETION_GRACE_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

/** How long an emailed deletion-verification token stays valid. */
export const DELETION_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

/** Default export format when the client does not specify one. */
export const DEFAULT_EXPORT_FORMAT = 'json';

/** Supported export formats. */
export const EXPORT_FORMATS = ['json', 'csv', 'zip'] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

/** Lifecycle of an asynchronous export job. */
export enum DataExportStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

/** Lifecycle of an account-deletion request. */
export enum DeletionRequestStatus {
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
  SCHEDULED = 'SCHEDULED',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED',
}

/** Audit actions recorded for GDPR activity. */
export enum GdprAuditAction {
  DATA_EXPORT_REQUESTED = 'DATA_EXPORT_REQUESTED',
  DATA_EXPORT_COMPLETED = 'DATA_EXPORT_COMPLETED',
  DATA_EXPORT_FAILED = 'DATA_EXPORT_FAILED',
  ACCOUNT_DELETION_REQUESTED = 'ACCOUNT_DELETION_REQUESTED',
  ACCOUNT_DELETION_VERIFICATION_SENT = 'ACCOUNT_DELETION_VERIFICATION_SENT',
  ACCOUNT_DELETION_SCHEDULED = 'ACCOUNT_DELETION_SCHEDULED',
  ACCOUNT_DELETION_CANCELLED = 'ACCOUNT_DELETION_CANCELLED',
  ACCOUNT_DELETION_COMPLETED = 'ACCOUNT_DELETION_COMPLETED',
}
