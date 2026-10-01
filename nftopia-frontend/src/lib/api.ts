import { fetchWithAuth } from '@/lib/api/fetchWithAuth';
import { API_CONFIG } from '@/lib/config';
import type { ReportReason, ReportTargetType } from '@/src/lib/constants';

export interface ReportPayload {
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  details?: string;
}

export async function submitReport(payload: ReportPayload): Promise<void> {
  await fetchWithAuth(`${API_CONFIG.baseUrl}/moderation/reports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}
