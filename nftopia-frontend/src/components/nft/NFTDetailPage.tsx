import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ReportModal } from '@/components/ui/report-modal';
import { api } from '@/lib/api';

interface NFTDetailPageProps {
  nftId: string;
  creatorId: string;
}

export const NFTDetailPage: React.FC<NFTDetailPageProps> = ({ nftId, creatorId }) => {
  const { t } = useTranslation();
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [hasReported, setHasReported] = useState(false);

  // Check if user has already reported this NFT in the current session
  useEffect(() => {
    const reportedItems = JSON.parse(localStorage.getItem('reported_items') || '{}');
    if (reportedItems[nftId]) {
      setHasReported(true);
    }
  }, [nftId]);

  const handleReportSubmit = async (reason: string, description?: string) => {
    try {
      await api.post('/reports', {
        targetType: 'nft',
        targetId: nftId,
        reason,
        description,
      });

      // Mark as reported in local storage
      const reportedItems = JSON.parse(localStorage.getItem('reported_items') || '{}');
      reportedItems[nftId] = true;
      localStorage.setItem('reported_items', JSON.stringify(reportedItems));

      setHasReported(true);
      toast.success(t('report.success')); // Assuming translation key exists
      setIsReportModalOpen(false);
    } catch (error) {
      console.error('Failed to submit report:', error);
      toast.error(t('report.error')); // Assuming translation key exists
    }
  };

  return (
    <div className="nft-detail-page">
      {/* NFT Content */}
      <div className="nft-content">
        {/* NFT details would go here */}
      </div>

      {/* Report Button */}
      <div className="nft-actions">
        {hasReported ? (
          <Button variant="outline" disabled>
            {t('report.already_reported')}
          </Button>
        ) : (
          <Button
            variant="ghost"
            onClick={() => setIsReportModalOpen(true)}
            className="text-muted-foreground hover:text-destructive"
          >
            {t('report.flag')}
          </Button>
        )}
      </div>

      {/* Report Modal */}
      <ReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        onSubmit={handleReportSubmit}
        targetType="nft"
        targetId={nftId}
      />
    </div>
  );
};