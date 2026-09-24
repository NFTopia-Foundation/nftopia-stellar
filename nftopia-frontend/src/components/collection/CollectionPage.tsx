import React, { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Flag, Loader2 } from 'lucide-react';
import { ReportModal } from '@/components/common/ReportModal';

interface CollectionPageProps {
  collectionId: string;
  collectionData: any; // Replace with actual type
}

export const CollectionPage: React.FC<CollectionPageProps> = ({ collectionId, collectionData }) => {
  const { toast } = useToast();
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasReported, setHasReported] = useState(false);

  const handleReportClick = () => {
    if (hasReported) return;
    setIsReportModalOpen(true);
  };

  const handleReportSubmit = async (reason: string, comment?: string) => {
    setIsSubmitting(true);
    try {
      // TODO: Implement actual API call to report endpoint
      // await api.reportContent({ type: 'collection', id: collectionId, reason, comment });
      
      // Simulate success for now
      setHasReported(true);
      toast({
        title: "Report Submitted",
        description: "Thank you for helping keep our community safe.",
      });
    } catch (error) {
      toast({
        title: "Failed to submit report",
        description: "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
      setIsReportModalOpen(false);
    }
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
          className={hasReported ? 'opacity-50 cursor-not-allowed' : ''}
        >
          {hasReported ? (
            <span>Reported</span>
          ) : (
            <>
              <Flag className="w-4 h-4 mr-2" />
              Report
            </>
          )}
        </Button>
      </div>

      {/* Placeholder for collection content */}
      <div className="border rounded p-4">
        <p>Collection details go here...</p>
      </div>

      <ReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        onSubmit={handleReportSubmit}
        itemType="collection"
        itemId={collectionId}
      />
    </div>
  );
};