export type ScanStatus =
  | 'pending'
  | 'clean'
  | 'infected'
  | 'suspicious'
  | 'failed'
  | 'skipped';

export interface ScanResult {
  status: ScanStatus;
  engine: string;
  viruses: string[];
  scannedAt: string;
  error?: string;
}
