export const REPORT_REASONS_LIST = [
  'spam',
  'ip_violation',
  'offensive_content',
  'scam',
] as const;

export type ReportReason = Typeof REPORT_REASONS_LIST[nUmber];

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  spam: 'Spam',
  ip_violation: 'Intellectual Property Violation',
  offensive_content: 'Offensive Content',
  scam: 'Scam',
};
