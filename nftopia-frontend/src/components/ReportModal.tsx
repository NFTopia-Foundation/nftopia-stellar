import React, { useEffect, useRef, useState } from 'react';
import { X, CheckCircle, Loader2 } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { REPORT_REASONS_LIST, type ReportReason } from '@/src/lib/constants';

export interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reason: ReportReason, details: string) => Promise<void>;
  isLoading?: boolean;
  success?: boolean;
}

export const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isLoading = false,
  success = false,
}) => {
  const { t } = useTranslation();
  const [selectedReason, setSelectedReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    dialogRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isLoading) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  const handleClose = () => {
    setSelectedReason(null);
    setDetails('');
    onClose();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedReason || isLoading) return;
    await onSubmit(selectedReason, details);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-modal-title"
        tabIndex={-1}
        className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800 focus:outline-none"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2
            id="report-modal-title"
            className="text-xl font-semibold text-gray-900 dark:text-white"
          >
            {t('report.title')}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            disabled={isLoading}
            aria-label={t('report.close')}
            className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300 disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        {success ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CheckCircle className="mb-4 text-emerald-500" size={48} aria-hidden="true" />
            <h3 className="mb-2 text-lg font-medium text-gray-900 dark:text-white">
              {t('report.successTitle')}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('report.successBody')}
            </p>
            <button
              type="button"
              onClick={handleClose}
              className="mt-6 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600"
            >
              {t('report.close')}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <span className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('report.selectReason')}
              </span>
              <div className="space-y-2" role="radiogroup" aria-label={t('report.selectReason')}>
                {REPORT_REASONS_LIST.map((reason) => (
                  <label
                    key={reason}
                    className={`flex cursor-pointer items-start rounded-md border p-3 transition-colors ${
                      selectedReason === reason
                        ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/20'
                        : 'border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="reportReason"
                      value={reason}
                      checked={selectedReason === reason}
                      onChange={() => setSelectedReason(reason)}
                      disabled={isLoading}
                      className="mt-1 h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800"
                    />
                    <span className="ml-3">
                      <span className="block text-sm font-medium text-gray-900 dark:text-white">
                        {t(`report.reasons.${reason}.label`)}
                      </span>
                      <span className="block text-xs text-gray-500 dark:text-gray-400">
                        {t(`report.reasons.${reason}.description`)}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <label
                htmlFor="report-details"
                className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                {t('report.detailsLabel')}
              </label>
              <textarea
                id="report-details"
                rows={3}
                maxLength={500}
                disabled={isLoading}
                className="w-full rounded-md border border-gray-300 p-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500 disabled:opacity-60"
                placeholder={t('report.detailsPlaceholder')}
                value={details}
                onChange={(event) => setDetails(event.target.value)}
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={handleClose}
                disabled={isLoading}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 disabled:opacity-50"
              >
                {t('report.cancel')}
              </button>
              <button
                type="submit"
                disabled={!selectedReason || isLoading}
                className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-white ${
                  selectedReason && !isLoading
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'cursor-not-allowed bg-gray-400'
                }`}
              >
                {isLoading && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
                {isLoading ? t('report.submitting') : t('report.submit')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ReportModal;
