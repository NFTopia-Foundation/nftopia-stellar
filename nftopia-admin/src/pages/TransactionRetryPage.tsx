import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { createAuthorizedFetch } from '../auth/authorizedFetch'
import { useAuth } from '../auth/useAuth'
import ConfirmActionDialog from '../components/ConfirmActionDialog'
import { DlqMetricsPanel } from '../components/DlqMetricsPanel'
import { DlqTable } from '../components/DlqTable'
import { canManageDlq } from '../dlq/access'
import {
  createDlqApi,
  DlqApiError,
  MAX_PAGE_SIZE,
  type DlqEntry,
  type RetryMetrics,
} from '../dlq/dlqApi'
import { bucketByDay, bulkRetryPhrase, cleanupPhrase, normalizeFailureReason, recentActivity, type FailureReasonCategory } from '../dlq/dlqStats'

const PAGE_SIZE = 20
const DEFAULT_BULK_LIMIT = 50
const DEFAULT_CLEANUP_DAYS = 30

type Dialog =
  | { kind: 'retry'; entry: DlqEntry }
  | { kind: 'cancel'; entry: DlqEntry }
  | { kind: 'bulk' }
  | { kind: 'cleanup' }

/**
 * Transaction retry / dead-letter-queue operations: metrics, the DLQ list, and
 * retry, bulk retry, cancel and cleanup actions, each behind a confirmation.
 */
export default function TransactionRetryPage() {
  const { t } = useTranslation()
  const { state, store } = useAuth()
  const api = useMemo(() => createDlqApi(createAuthorizedFetch(store)), [store])
  const allowed = state.status === 'authenticated' && canManageDlq(state.user.role)

  const [metrics, setMetrics] = useState<RetryMetrics | null>(null)
  const [sample, setSample] = useState<DlqEntry[]>([])
  const [entries, setEntries] = useState<DlqEntry[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [dialog, setDialog] = useState<Dialog | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [bulkLimit, setBulkLimit] = useState(DEFAULT_BULK_LIMIT)
  const [cleanupDays, setCleanupDays] = useState(DEFAULT_CLEANUP_DAYS)
  const [selectedReason, setSelectedReason] = useState<FailureReasonCategory | null>(null)

  const describe = useCallback(
    (error: unknown) => (error instanceof DlqApiError ? error.message : t('dlq.error.network')),
    [t],
  )

  const load = useCallback(
    async (targetPage: number) => {
      setLoading(true)
      try {
        // The newest page of up to 100 entries feeds the trend and recent activity.
        const [nextMetrics, list, newest] = await Promise.all([
          api.getMetrics(),
          api.listDlq(targetPage, PAGE_SIZE),
          api.listDlq(1, MAX_PAGE_SIZE),
        ])
        setMetrics(nextMetrics)
        setEntries(list.data)
        setTotal(list.total)
        setSample(newest.data)
        setLoadError(null)
      } catch (error) {
        setLoadError(`${t('dlq.error.load')} ${describe(error)}`)
      } finally {
        setLoading(false)
      }
    },
    [api, describe, t],
  )

  useEffect(() => {
    if (allowed) void load(page)
  }, [allowed, load, page])

  const refreshMetrics = useCallback(async () => {
    try {
      setMetrics(await api.getMetrics())
    } catch {
      // The action itself succeeded; stale counts are corrected by the next refresh.
    }
  }, [api])

  const open = (next: Dialog) => {
    setActionError(null)
    setReason('')
    if (next.kind === 'bulk') setBulkLimit(Math.min(DEFAULT_BULK_LIMIT, Math.max(1, metrics?.dlq ?? 1)))
    if (next.kind === 'cleanup') setCleanupDays(DEFAULT_CLEANUP_DAYS)
    setDialog(next)
  }

  const close = () => {
    if (!submitting) setDialog(null)
  }

  /** Replaces one row in place, so a re-queued entry stays visible and can be cancelled. */
  const replaceRow = (retryId: string, patch: Partial<DlqEntry>) => {
    setEntries((rows) => rows.map((row) => (row.retryId === retryId ? { ...row, ...patch } : row)))
  }

  const run = async (action: () => Promise<string>) => {
    setSubmitting(true)
    setActionError(null)
    try {
      const message = await action()
      setNotice(message)
      setDialog(null)
    } catch (error) {
      setActionError(describe(error))
    } finally {
      setSubmitting(false)
    }
  }

  const confirm = () => {
    if (!dialog) return
    switch (dialog.kind) {
      case 'retry':
        return run(async () => {
          const updated = await api.retryEntry(dialog.entry.retryId, reason)
          replaceRow(dialog.entry.retryId, {
            ...updated,
            status: updated?.status ?? 'pending',
            attemptCount: updated?.attemptCount ?? 0,
            lastError: updated?.lastError ?? null,
          })
          await refreshMetrics()
          return t('dlq.notice.retried', { tx: dialog.entry.transactionId })
        })
      case 'cancel':
        return run(async () => {
          await api.cancelRetry(dialog.entry.retryId)
          replaceRow(dialog.entry.retryId, { status: 'cancelled' })
          await refreshMetrics()
          return t('dlq.notice.cancelled', { tx: dialog.entry.transactionId })
        })
      case 'bulk':
        return run(async () => {
          const result = await api.bulkRetry(bulkLimit)
          const failed = result.results.filter((item) => !item.success)
          // Bulk retry takes the newest entries, so show the first page afterwards.
          if (page === 1) await load(1)
          else setPage(1)
          return t('dlq.notice.bulk', { ok: result.results.length - failed.length, failed: failed.length })
        })
      case 'cleanup':
        return run(async () => {
          const result = await api.cleanup(cleanupDays)
          await load(page)
          // Shown verbatim: the backend's reply is the only record of what it did.
          return t('dlq.notice.cleanup', { message: result?.message ?? '' })
        })
    }
  }

  if (!allowed) {
    return (
      <section className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-white">{t('dlq.title')}</h1>
        <p role="alert" className="text-sm text-slate-400">{t('dlq.forbidden')}</p>
      </section>
    )
  }

  const bulkCount = Math.min(bulkLimit, metrics?.dlq ?? 0)
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const bulkLimitValid = Number.isInteger(bulkLimit) && bulkLimit >= 1 && bulkLimit <= MAX_PAGE_SIZE
  const cleanupValid = Number.isInteger(cleanupDays) && cleanupDays >= 1

  return (
    <section aria-label={t('dlq.title')} className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">{t('dlq.title')}</h1>
          <p className="mt-1 text-sm text-slate-400">{t('dlq.description')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void load(page)}
            disabled={loading}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-slate-200 transition hover:bg-white/10 disabled:opacity-50"
          >
            {t('dlq.actions.refresh')}
          </button>
          <button
            type="button"
            onClick={() => open({ kind: 'cleanup' })}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-slate-200 transition hover:bg-white/10"
          >
            {t('dlq.actions.cleanup')}
          </button>
          <button
            type="button"
            onClick={() => open({ kind: 'bulk' })}
            disabled={!metrics || metrics.dlq === 0}
            className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-red-500 disabled:opacity-50"
          >
            {t('dlq.actions.bulkRetry')}
          </button>
        </div>
      </header>

      {loadError ? (
        <p role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {loadError}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          {notice}
        </p>
      ) : null}

      {metrics ? (
        <DlqMetricsPanel
          metrics={metrics}
          trend={bucketByDay(sample, Date.now())}
          recent={recentActivity(sample)}
          reasonEntries={sample}
          sampleSize={sample.length}
          selectedReason={selectedReason}
          onReasonSelect={setSelectedReason}
        />
      ) : loading ? (
        <p className="text-sm text-slate-400">{t('dlq.loading')}</p>
      ) : null}

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-white">{t('dlq.listTitle', { count: total })}</h2>
        <DlqTable
          entries={selectedReason ? entries.filter((entry) => normalizeFailureReason(entry.lastError) === selectedReason) : entries}
          busy={submitting}
          onRetry={(entry) => open({ kind: 'retry', entry })}
          onCancel={(entry) => open({ kind: 'cancel', entry })}
        />
        {pages > 1 ? (
          <nav aria-label={t('dlq.pagination.label')} className="flex items-center justify-end gap-2 text-sm text-slate-400">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((current) => current - 1)}
              className="rounded-md border border-white/10 px-2 py-1 disabled:opacity-50"
            >
              {t('dlq.pagination.previous')}
            </button>
            <span>{t('dlq.pagination.status', { page, pages })}</span>
            <button
              type="button"
              disabled={page >= pages || loading}
              onClick={() => setPage((current) => current + 1)}
              className="rounded-md border border-white/10 px-2 py-1 disabled:opacity-50"
            >
              {t('dlq.pagination.next')}
            </button>
          </nav>
        ) : null}
      </div>

      <ConfirmActionDialog
        open={dialog?.kind === 'retry'}
        title={t('dlq.confirm.retryTitle')}
        description={dialog?.kind === 'retry' ? t('dlq.confirm.retryBody', { tx: dialog.entry.transactionId }) : ''}
        confirmLabel={t('dlq.actions.retry')}
        submitting={submitting}
        error={actionError}
        onConfirm={confirm}
        onClose={close}
      >
        <label htmlFor="retry-reason" className="block text-sm text-slate-300">
          {t('dlq.confirm.reason')}
          <textarea
            id="retry-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={2}
            disabled={submitting}
            className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none"
          />
        </label>
      </ConfirmActionDialog>

      <ConfirmActionDialog
        open={dialog?.kind === 'cancel'}
        title={t('dlq.confirm.cancelTitle')}
        description={dialog?.kind === 'cancel' ? t('dlq.confirm.cancelBody', { tx: dialog.entry.transactionId }) : ''}
        confirmLabel={t('dlq.actions.cancel')}
        danger
        submitting={submitting}
        error={actionError}
        onConfirm={confirm}
        onClose={close}
      />

      <ConfirmActionDialog
        open={dialog?.kind === 'bulk'}
        title={t('dlq.confirm.bulkTitle')}
        description={t('dlq.confirm.bulkBody', { count: bulkCount, total: metrics?.dlq ?? 0 })}
        confirmLabel={t('dlq.actions.bulkRetry')}
        phrase={bulkRetryPhrase(bulkCount)}
        danger
        submitting={submitting}
        error={actionError}
        confirmDisabled={!bulkLimitValid || bulkCount === 0}
        onConfirm={confirm}
        onClose={close}
      >
        <label className="block text-sm text-slate-300">
          {t('dlq.confirm.bulkLimit', { max: MAX_PAGE_SIZE })}
          <input
            type="number"
            min={1}
            max={MAX_PAGE_SIZE}
            value={bulkLimit}
            onChange={(event) => setBulkLimit(Number(event.target.value))}
            disabled={submitting}
            className="mt-1 w-32 rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none"
          />
        </label>
      </ConfirmActionDialog>

      <ConfirmActionDialog
        open={dialog?.kind === 'cleanup'}
        title={t('dlq.confirm.cleanupTitle')}
        description={t('dlq.confirm.cleanupBody', { days: cleanupDays })}
        confirmLabel={t('dlq.actions.cleanup')}
        phrase={cleanupPhrase(cleanupDays)}
        danger
        submitting={submitting}
        error={actionError}
        confirmDisabled={!cleanupValid}
        onConfirm={confirm}
        onClose={close}
      >
        <label className="block text-sm text-slate-300">
          {t('dlq.confirm.cleanupDays')}
          <input
            type="number"
            min={1}
            value={cleanupDays}
            onChange={(event) => setCleanupDays(Number(event.target.value))}
            disabled={submitting}
            className="mt-1 w-32 rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none"
          />
        </label>
      </ConfirmActionDialog>
    </section>
  )
}
