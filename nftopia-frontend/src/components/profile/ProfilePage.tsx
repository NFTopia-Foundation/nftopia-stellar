import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Flag } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { useReport } from '@/src/hooks/useReport';
import { ReportModal } from '@/src/components/ReportModal';

interface ProfilePageProps {
  profileId: string;
}

export default function ProfilePage({ profileId }: ProfilePageProps) {
  const { t } = useTranslation();
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [success, setSuccess] = useState(false);

  const { isSubmitting, hasReported, submitReport } = useReport('profile', profileId, {
    onSuccess: () => setSuccess(true),
  });

  const handleOpenReportModal = () => {
    if (hasReported || isSubmitting) return;
    setSuccess(false);
    setIsReportModalOpen(true);
  };

  const handleCloseReportModal = () => {
    setIsReportModalOpen(false);
    setSuccess(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Creator Profile</h1>
          <Button
            variant="outline"
            onClick={handleOpenReportModal}
            disabled={hasReported || isSubmitting}
            className="text-muted-foreground hover:text-foreground"
          >
            {hasReported ? (
              <span>{t('report.alreadyReported')}</span>
            ) : (
              <>
                <Flag className="w-4 h-4 mr-2" aria-hidden="true" />
                {t('report.action')}
              </>
            )}
          </Button>
        </div>

        <div className="border rounded p-4">
          <p>Profile details go here...</p>
        </div>
      </div>

      <ReportModal
        isOpen={isReportModalOpen}
        onClose={handleCloseReportModal}
        onSubmit={submitReport}
        isLoading={isSubmitting}
        success={success}
      />
    </div>
  );
}
