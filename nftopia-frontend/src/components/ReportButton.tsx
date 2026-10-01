"use client";

import React, { useState } from 'react';
import { Flag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/useTranslation';
import { useReport } from '@/src/hooks/useReport';
import { ReportModal } from '@/src/components/ReportModal';
import type { ReportTargetType } from '@/src/lib/constants';

interface ReportButtonProps {
  targetType: ReportTargetType;
  targetId: string;
  className?: string;
}

export function ReportButton({ targetType, targetId, className }: ReportButtonProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [success, setSuccess] = useState(false);

  const { isSubmitting, hasReported, submitReport } = useReport(targetType, targetId, {
    onSuccess: () => setSuccess(true),
  });

  const handleOpen = () => {
    if (hasReported || isSubmitting) return;
    setSuccess(false);
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
    setSuccess(false);
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={handleOpen}
        disabled={hasReported || isSubmitting}
        className={
          className ?? 'border-gray-700 bg-transparent text-gray-200 hover:bg-gray-800/60'
        }
        aria-label={hasReported ? t('report.alreadyReported') : t('report.action')}
      >
        <Flag className="h-4 w-4" aria-hidden="true" />
        <span className="ml-2">{hasReported ? t('report.alreadyReported') : t('report.action')}</span>
      </Button>

      <ReportModal
        isOpen={isOpen}
        onClose={handleClose}
        onSubmit={submitReport}
        isLoading={isSubmitting}
        success={success}
      />
    </>
  );
}

export default ReportButton;
