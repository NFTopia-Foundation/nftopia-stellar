import { toast } from "@/lib/toast";

export interface ReportPayload {
  targetType: 'nft' | 'collection' | 'profile';
  targetId: string;
  reason: string;
  details?: string;
}

export async function submitReport(payload: ReportPayload): Promise<boolean> {
  try {
    const response = await fetch('/api/reports', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error('Failed to submit report');
    }

    toast.success('Report submitted successfully');
    return true;
  } catch (error) {
    toast.error('Failed to submit report. Please try again.');
    return false;
  }
}