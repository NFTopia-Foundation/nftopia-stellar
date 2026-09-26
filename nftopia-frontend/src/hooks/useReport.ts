import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';

export type ReportReason = 'spam' | 'scam' | 'offensive' | 'ip_violation' | 'other';

export const REPORT_REASON_TAXONOMY: Record<ReportReason, string> = {
  spam: 'Spam or misleading content',
  scam: 'Scam or fraudulent activity',
  offensive: 'Offensive or inappropriate content',
  ip_violation: 'Intellectual property violation',
  other: 'Other',
};

interface UseReportOptions {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

interface UseReportReturn {
  isSubmitting: boolean;
  hasReported: boolean;
  submitReport: (reason: ReportReason, description?: string) => Promise<void>;
  resetReport: () => void;
}

export function useReport(
  entityType: 'nft' | 'collection' | 'profile',
  entityId: string,
  options: UseReportOptions = {}
): UseReportReturn {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasReported, setHasReported] = useState(false);

  const submitReport = useCallback(
    async (reason: ReportReason, description?: string) => {
      if (hasReported || isSubmitting) return;

      setIsSubmitting(true);
      try {
        await api.post('/reports', {
          entityType,
          entityId,
          reason,
          description,
        });

        setHasReported(true);
        toast({
          title: 'Report submitted',
          description: 'Thank you for your report. We will review it shortly.',
          variant: 'default',
        });

        if (options.onSuccess) {
          options.onSuccess();
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to submit report';
        toast({
          title: 'Report failed',
          description: errorMessage,
          variant: 'destructive',
        });

        if (options.onError) {
          options.onError(error instanceof Error ? error : new Error(errorMessage));
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [entityType, entityId, hasReported, isSubmitting, toast, options]
  );

  const resetReport = useCallback(() => {
    setHasReported(false);
  }, []);

  return {
    isSubmitting,
    hasReported,
    submitReport,
    resetReport,
  };
}