"use client";

import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/lib/stores';
import { useTranslation } from '@/hooks/useTranslation';
import { submitReport } from '@/src/lib/api';
import type { ReportReason, ReportTargetType } from '@/src/lib/constants';

function reportStorageKey(targetType: ReportTargetType, targetId: string): string {
  return `report:${targetType}:${targetId}`;
}

function readReported(targetType: ReportTargetType, targetId: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return sessionStorage.getItem(reportStorageKey(targetType, targetId)) === '1';
  } catch {
    return false;
  }
}

function writeReported(targetType: ReportTargetType, targetId: string): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(reportStorageKey(targetType, targetId), '1');
  } catch {
    // sessionStorage unavailable (private mode) — fall back to in-memory state
  }
}

interface UseReportOptions {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

interface UseReportReturn {
  isSubmitting: boolean;
  hasReported: boolean;
  submitReport: (reason: ReportReason, details?: string) => Promise<void>;
  resetReport: () => void;
}

export function useReport(
  targetType: ReportTargetType,
  entityId: string,
  options: UseReportOptions = {}
): UseReportReturn {
  const { showSuccess, showError } = useToast();
  const { t } = useTranslation();
  const { onSuccess, onError } = options;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasReported, setHasReported] = useState(false);

  useEffect(() => {
    setHasReported(readReported(targetType, entityId));
  }, [targetType, entityId]);

  const submitReportHandler = useCallback(
    async (reason: ReportReason, details?: string) => {
      if (hasReported || isSubmitting) return;

      setIsSubmitting(true);
      try {
        await submitReport({ targetType, targetId: entityId, reason, details });

        writeReported(targetType, entityId);
        setHasReported(true);
        showSuccess(t('report.success'));

        if (onSuccess) {
          onSuccess();
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Failed to submit report');
        showError(t('report.error'));

        if (onError) {
          onError(err);
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [targetType, entityId, hasReported, isSubmitting, showSuccess, showError, t, onSuccess, onError]
  );

  const resetReport = useCallback(() => {
    setHasReported(false);
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem(reportStorageKey(targetType, entityId));
      } catch {
        // ignore
      }
    }
  }, [targetType, entityId]);

  return {
    isSubmitting,
    hasReported,
    submitReport: submitReportHandler,
    resetReport,
  };
}
