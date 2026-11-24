import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { confirmationMatches } from '../dlq/dlqStats'
import { useFocusTrap } from './useFocusTrap'

export interface ConfirmActionDialogProps {
  open: boolean
  title: string
  /** What will happen, in plain words. */
  description: ReactNode
  confirmLabel: string
  /** When set, the confirm button stays disabled until this exact text is typed. */
  phrase?: string
  /** Red styling for actions with a wide or irreversible effect. */
  danger?: boolean
  submitting?: boolean
  error?: string | null
  /** Extra inputs (reason, limit, days) rendered above the confirmation. */
  children?: ReactNode
  /** Disables confirm while the extra inputs are invalid. */
  confirmDisabled?: boolean
  onConfirm: () => void | Promise<void>
  onClose: () => void
}

/**
 * The shared confirm dialog for destructive admin actions (#700): a title,
 * a description, and confirm/cancel, with an optional typed-phrase gate and
 * extra inputs for actions that need them (a reason, a bulk count, …).
 * Mounted only while open, so the typed text starts empty for each action,
 * and so that mount/unmount lines up with `useFocusTrap`'s focus-in /
 * restore-focus-on-close. The phrase is compared on every render: if it
 * changes (say the bulk count is edited), text typed for the old one stops
 * matching and must be retyped.
 */
export default function ConfirmActionDialog({ open, ...props }: ConfirmActionDialogProps) {
  if (!open) return null
  return <ConfirmActionDialogForm {...props} />
}

function ConfirmActionDialogForm({
  title,
  description,
  confirmLabel,
  phrase,
  danger = false,
  submitting = false,
  error = null,
  children,
  confirmDisabled = false,
  onConfirm,
  onClose,
}: Omit<ConfirmActionDialogProps, 'open'>) {
  const { t } = useTranslation()
  const [typed, setTyped] = useState('')
  const phraseOk = phrase === undefined || confirmationMatches(typed, phrase)
  const containerRef = useFocusTrap<HTMLDivElement>()

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-action-title"
    >
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
        <h2 id="confirm-action-title" className="text-lg font-semibold text-white">
          {title}
        </h2>
        <div className="mt-2 text-sm text-slate-300">{description}</div>

        {children ? <div className="mt-4 flex flex-col gap-3">{children}</div> : null}

        {phrase !== undefined ? (
          <div className="mt-4">
            <label htmlFor="confirm-action-phrase" className="block text-sm text-slate-300">
              {t('dlq.confirm.typePhrase')} <code className="rounded bg-white/10 px-1.5 py-0.5 text-amber-300">{phrase}</code>
            </label>
            <input
              id="confirm-action-phrase"
              type="text"
              autoComplete="off"
              spellCheck={false}
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              disabled={submitting}
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none"
            />
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="mt-3 text-sm text-red-300">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/10 disabled:opacity-50"
          >
            {t('dlq.confirm.cancel')}
          </button>
          <button
            type="button"
            onClick={() => void onConfirm()}
            disabled={submitting || !phraseOk || confirmDisabled}
            className={[
              'rounded-lg px-4 py-2 text-sm font-medium text-white transition disabled:opacity-50',
              danger ? 'bg-red-600 hover:bg-red-500' : 'bg-cyan-600 hover:bg-cyan-500',
            ].join(' ')}
          >
            {submitting ? t('dlq.confirm.working') : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
