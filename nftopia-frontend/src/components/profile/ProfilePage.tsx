import React, { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { ReportModal } from '@/components/reports/ReportModal';
import { reportContent } from '@/lib/api/reports';
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { ProfileNFTs } from '@/components/profile/ProfileNFTs';
import { ProfileStats } from '@/components/profile/ProfileStats';
import { Loader2 } from 'lucide-react';

interface ProfilePageProps {
  profileId: string;
}

export default function ProfilePage({ profileId }: ProfilePageProps) {
  const { toast } = useToast();
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [hasReported, setHasReported] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleReportSubmit = useCallback(async (reason: string, details?: string) => {
    setIsSubmitting(true);
    try {
      await reportContent({
        targetType: 'profile',
        targetId: profileId,
        reason,
        details,
      });
      setHasReported(true);
      toast({
        title: 'Report Submitted',
        description: 'Thank you for your report. We will review it shortly.',
        variant: 'default',
      });
    } catch (error) {
      toast({
        title: 'Failed to Submit Report',
        description: 'Please try again later.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
      setIsReportModalOpen(false);
    }
  }, [profileId, toast]);

  const handleOpenReportModal = () => {
    if (!hasReported) {
      setIsReportModalOpen(true);
    }
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
              <>
                <span className="mr-2">Reported</span>
              </>
            ) : (
              'Report Profile'
            )}
          </Button>
        </div>

        <ProfileHeader profileId={profileId} />
        <ProfileStats profileId={profileId} />
        <ProfileNFTs profileId={profileId} />
      </div>

      <ReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        onSubmit={handleReportSubmit}
        isSubmitting={isSubmitting}
        targetType="profile"
        targetId={profileId}
      />
    </div>
  );
}