import { useEffect, useState } from 'react';

export type ResolutionOutcome = 'approve' | 'reject' | 'dismiss';

export interface ResolveFlagPayload {
  outcome: ResolutionOutcome;
  reason?: string;
}

export interface ResolveFlagDialogProps {
  open: boolean;
  flagId?: string;
  flagCount?: number;
  defaultOutcome?: ResolutionOutcome;
  submitting?: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (payload: ResolveFlagPayload) => void | Promise<void>;
}

const OUTCOMES: ResolutionOutcome[] = ['approve', 'reject', 'dismiss'];

const OUTCOME_LABELS: Record<ResolutionOutcome, string> = {
  approve: 'Approve',
  reject: 'Reject',
  dismiss: 'Dismiss',
};

const OUTCOME_DESCRIPTIONS: Record<ResolutionOutcome, string> = {
  approve: 'Confirm the flagged content is acceptable and keep it visible.',
  reject: 'Confirm the flagged content violates policy and remove it.',
  dismiss: 'Mark the flag as a false positive without acting on the content.',
};

export default function ResolveFlagDialog({
  open,
  flagId,
  flagCount,
  defaultOutcome = 'approve',
  submitting = false,
  error = null,
  onClose,
  onSubmit,
}: ResolveFlagDialogProps) {
  const [outcome, setOutcome] = useState<ResolutionOutcome>(defaultOutcome);
  const [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (open) {
      setOutcome(defaultOutcome);
      setReason('');
      setConfirming(false);
    }
  }, [open, defaultOutcome]);

  if (!open) {
    return null;
  }

  const isBulk = typeof flagCount === 'number' && flagCount > 1;
  const title = isBulk ? `Resolve ${flagCount} flags` : 'Resolve flag';

  const handleConfirm = () => {
    setConfirming(true);
  };

  const handleSubmit = async () => {
    const trimmedReason = reason.trim();
    const payload: ResolveFlagPayload = trimmedReason
      ? { outcome, reason: trimmedReason }
      : { outcome };
    await onSubmit(payload);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" role="dialog" aria-modal="true" aria-labelledby="resolve-flag-title">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 p-6">
        <h2 id="resolve-flag-title" className="text-lg font-semibold text-gray-900">
          {title}
        </h2>
        {flagId && !isBulk ? (
          <p className="mt-1 text-sm text-gray-500">Flag {flagId}</p>
        ) : null}

        <fieldset className="mt-4" disabled={confirming || submitting}>
          <legend className="text-sm font-medium text-gray-700">Outcome</legend>
          <div className="mt-2 space-y-2">
            {OUTCOMES.map((option) => (
              <label
                key={option}
                className={`flex items-start gap-3 rounded-md border p-3 cursor-pointer transition ${
                  outcome === option
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="resolve-outcome"
                  value={option}
                  checked={outcome === option}
                  onChange={() => setOutcome(option)}
                  className="mt-1"
                />
                <span>
                  <span className="block text-sm font-medium text-gray-900">
                    {OUTCOME_LABELS[option]}
                  </span>
                  <span className="block text-xs text-gray-500">
                    {OUTCOME_DESCRIPTIONS[option]}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mt-4">
          <label htmlFor="resolve-reason" className="block text-sm font-medium text-gray-700">
            Reason <span className="text-gray-400">(optional)</span>
          </label>
          <textarea
            id="resolve-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={confirming || submitting}
            rows={3}
            placeholder="Add context for this resolution..."
            className="mt-1 w-full rounded-md border border-gray-300 p-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>

        {error ? (
          <p className="mt-3 text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}

        {confirming ? (
          <div className="mt-4 rounded-md bg-amber-50 border border-amber-200 p-3">
            <p className="text-sm text-amber-900">
              {isBulk
                ? `Are you sure you want to ${OUTCOME_LABELS[outcome].toLowerCase()} ${flagCount} flags? This cannot be undone.`
                : `Are you sure you want to ${OUTCOME_LABELS[outcome].toLowerCase()} this flag? This cannot be undone.`}
            </p>
          </div>
        ) : null}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={confirming || submitting}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          {confirming ? (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Confirm resolution'}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleConfirm}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Review resolution
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
