export const USER_PRIVACY_QUEUE = 'user-privacy';
export const FINALIZE_ACCOUNT_DELETION_JOB = 'finalize-account-deletion';
export const BUILD_USER_EXPORT_JOB = 'build-user-export';

export type UserExportFormat = 'json' | 'csv' | 'zip';

export interface FinalizeAccountDeletionJob {
  userId: string;
  requestedAt: string;
}

export interface BuildUserExportJob {
  userId: string;
  format: UserExportFormat;
}

export interface PreparedUserExport {
  fileName: string;
  contentType: string;
  contentBase64: string;
}
