import { useState } from 'react'

export interface RejectVerificationPayload {
  verificationId: string
  reason: string
}

export interface ApproveVerificationPayload {
  verificationId: string
}

export interface ResolveVerificationDialogProps {
  open: boolean
  verificationId?: string
  verificationName?: string
  bulk?: boolean
  submitting?: boolean
  error?: string | null
  onClose: () => void
  onSubmit: (payload: { action: 'approve' | 'reject'; reason?: string }) => void | Promise<void>
}

const OUTCOMES = ['approve', 'reject'] as const

const OUTCOME_LABELS: Record<'approve' | 'reject', string> = {
  approve: 'Approve',
  reject: 'Reject',
}

const OUTCOME_DESCRIPTIONS: Record<'approve' | 'reject', string> = {
  approve: 'Approve this collection for publication on the marketplace.',
  reject: 'Reject this collection and provide a reason for the creator.',
}

export default function ResolveVerificationDialog({
  open,
  ...props
}: ResolveVerificationDialogProps) {
  if (!open) {
    return null
  }

  return (
    <ResolveVerificationDialogForm
      key={props.verificationId ?? 'bulk'}
      {...props}
    />
  )
}

function ResolveVerificationDialogForm({
  verificationName,
  bulk = false,
  submitting = false,
  error = null,
  onClose,
  onSubmit,
}: Omit<ResolveVerificationDialogProps, 'open'>) {
  const [outcome, setOutcome] = useState<'approve' | 'reject'>('approve')
  const [reason, setReason] = useState('')
  const [confirming, setConfirming] = useState(false)

  const isBulk = Boolean(bulk)
  const title = isBulk ? 'Approve/reject selected collections' : `${OUTCOME_LABELS[outcome]} collection`

  const handleConfirm = () => {
    setConfirming(true)
  }

  const handleSubmit = async () => {
    const trimmedReason = reason.trim()
    if (outcome === 'reject' && !trimmedReason) {
      // Show validation error - will be displayed via the onSubmit error handling
      return
    }
    await onSubmit({
      action: outcome,
      reason: trimmedReason,
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" role="dialog" aria-modal="true" aria-labelledby="resolve-verification-title">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 p-6">
        <h2 id="resolve-verification-title" className="text-lg font-semibold text-gray-900">
          {title}
        </h2>

        {verificationName && !isBulk ? (
          <p className="mt-1 text-sm text-gray-500">Collection: {verificationName}</p>
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

        {error ? (
          <p className="mt-3 text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}

        {confirming ? (
          <div className="mt-4 rounded-md bg-amber-50 border border-amber-200 p-3">
            <p className="text-sm text-amber-900">
              {isBulk
                ? `Are you sure you want to ${OUTCOME_LABELS[outcome].toLowerCase()} the selected collections? This cannot be undone.`
                : `Are you sure you want to ${OUTCOME_LABELS[outcome].toLowerCase()} this collection? This cannot be undone.`}
            </p>
          </div>
        ) : null}

        {outcome === 'reject' && !isBulk ? (
          <div className="mt-4">
            <label htmlFor="reject-reason" className="block text-sm font-medium text-gray-700">
              Reason <span className="text-red-500">*</span>
            </label>
            <p className="mt-0.5 text-xs text-gray-400">
              Provide context for the creator so they can understand and correct the issue.
            </p>
            <textarea
              id="reject-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={confirming || submitting}
              rows={3}
              placeholder="e.g. Missing metadata, copyright issues, incomplete setup..."
              className="mt-1 w-full rounded-md border border-gray-300 p-2 text-sm focus:border-blue-500 focus:outline-none"
            />
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
              {submitting ? 'Submitting…' : 'Confirm'}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleConfirm}
              disabled={outcome === 'reject' && !isBulk && !reason.trim()}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {OUTCOME_LABELS[outcome]}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}