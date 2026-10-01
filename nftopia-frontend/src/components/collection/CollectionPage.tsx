import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Flag } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { useReport } from '@/src/hooks/useReport';
import { ReportModal } from '@/src/components/ReportModal';

interface CollectionPageProps {
  collectionId: string;
  collectionData: any;
}

export const CollectionPage: React.FC<CollectionPageProps> = ({ collectionId, collectionData }) => {
  const { t } = useTranslation();
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [success, setSuccess] = useState(false);

  const { isSubmitting, hasReported, submitReport } = useReport('collection', collectionId, {
    onSuccess: () => setSuccess(true),
  });

  const handleReportClick = () => {
    if (hasReported || isSubmitting) return;
    setSuccess(false);
    setIsReportModalOpen(true);
  };

  const handleCloseReportModal = () => {
    setIsReportModalOpen(false);
    setSuccess(false);
  };

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">{collectionData?.name || 'Collection'}</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={handleReportClick}
          disabled={hasReported || isSubmitting}
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
        <p>Collection details go here...</p>
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
};
