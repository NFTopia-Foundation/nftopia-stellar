export const REPORT_REASONS_LIST = [
  'spam',
  'copyright',
  'offensive',
  'scam',
  'other',
] as const;

export type ReportReason = typeof REPORT_REASONS_LIST[number];

export const REPORT_TARGET_TYPES = ['nft', 'collection', 'profile'] as const;

export type ReportTargetType = typeof REPORT_TARGET_TYPES[number];

export function isReportReason(value: string): value is ReportReason {
  return (REPORT_REASONS_LIST as readonly string[]).includes(value);
}
