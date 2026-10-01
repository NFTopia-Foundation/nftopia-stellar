import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/useTranslation';
import { useReport } from '@/src/hooks/useReport';
import { ReportModal } from '@/src/components/ReportModal';

interface NFTDetailPageProps {
  nftId: string;
  creatorId: string;
}

export const NFTDetailPage: React.FC<NFTDetailPageProps> = ({ nftId }) => {
  const { t } = useTranslation();
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [success, setSuccess] = useState(false);

  const { isSubmitting, hasReported, submitReport } = useReport('nft', nftId, {
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
    <div className="nft-detail-page">
      <div className="nft-content">
        {/* NFT details would go here */}
      </div>

      <div className="nft-actions">
        <Button
          variant="outline"
          onClick={handleOpenReportModal}
          disabled={hasReported || isSubmitting}
        >
          {hasReported ? t('report.alreadyReported') : t('report.action')}
        </Button>
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
