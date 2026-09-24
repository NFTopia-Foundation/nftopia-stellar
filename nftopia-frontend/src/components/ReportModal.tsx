import React, { useState } from 'react';
import { X, AlertTriangle, CheckCircle } from 'lucide-react';

// Report reason taxonomy as defined in the issue
export const REPORT_REASONS = [
  {
    id: 'spam',
    label: 'Spam or misleading content',
    description: 'Repetitive, irrelevant, or deceptive content.',
  },
  {
    id: 'ip_violation',
    label: 'Intellectual Property Violation',
    description: 'Content that infringes on copyright or trademark.',
  },
  {
    id: 'offensive',
    label: 'Offensive or harmful content',
    description: 'Content that is hateful, violent, or otherwise harmful.',
  },
  {
    id: 'scam',
    label: 'Scam or fraud',
    description: 'Content involved in fraudulent activities or scams.',
  },
  {
    id: 'other',
    label: 'Other',
    description: 'Other reasons not listed above.',
  },
] as const;

type ReportReason = (typeof REPORT_REASONS)[number]['id'];

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reason: ReportReason, comment: string) => Promise<void>;
  isLoading: boolean;
  success: boolean;
}

export const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
  success,
}) => {
  const [selectedReason, setSelectedReason] = useState<ReportReason | null>(null);
  const [comment, setComment] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReason) return;
    
    await onSubmit(selectedReason, comment);
  };

  const handleClose = () => {
    setSelectedReason(null);
    setComment('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Report Content
          </h2>
          <button
            onClick={handleClose}
            className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
            disabled={isLoading}
          >
            <X size={20} />
          </button>
        </div>

        {/* Success State */}
        {success ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CheckCircle className="mb-4 text-green-500" size={48} />
            <h3 className="mb-2 text-lg font-medium text-gray-900 dark:text-white">
              Report Submitted
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Thank you for your report. Our team will review it shortly.
            </p>
            <button
              onClick={handleClose}
              className="mt-6 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {/* Reason Selection */}
            <div className="mb-4">
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Select a reason <span className="text-red-500">*</span>
              </label>
              <div className="space-y-2">
                {REPORT_REASONS.map((reason) => (
                  <label
                    key={reason.id}
                    className={`flex cursor-pointer items-start rounded-md border p-3 transition-colors ${
                      selectedReason === reason.id
                        ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/20'
                        : 'border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="reportReason"
                      value={reason.id}
                      checked={selectedReason === reason.id}
                      onChange={() => setSelectedReason(reason.id)}
                      className="mt-1 h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800"
                    />
                    <div className="ml-3">
                      <span className="block text-sm font-medium text-gray-900 dark:text-white">
                        {reason.label}
                      </span>
                      <span className="block text-xs text-gray-500 dark:text-gray-400">
                        {reason.description}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Optional Comment */}
            <div className="mb-6">
              <label
                htmlFor="comment"
                className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Additional details (optional)
              </label>
              <textarea
                id="comment"
                rows={3}
                className="w-full rounded-md border border-gray-300 p-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500"
                placeholder="Provide more context about the issue..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                disabled={isLoading}
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!selectedReason || isLoading}
                className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-white ${
                  !selectedReason || isLoading
                    ? 'cursor-not-allowed bg-gray-400' 
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {isLoading && <AlertTriangle size={16} className="animate-pulse" />}
                {isLoading ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};