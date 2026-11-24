import { useTranslation } from 'react-i18next'
import { StatCard } from './Card'
import type { DlqEntry, RetryMetrics } from '../dlq/dlqApi'
import { formatUtc, shortId } from '../dlq/format'
import { groupFailureReasons, summarizeMetrics, type DayBucket, type FailureReasonCategory } from '../dlq/dlqStats'

interface DlqMetricsPanelProps {
  metrics: RetryMetrics
  /** DLQ entries per day, oldest first (see `bucketByDay`). */
  trend: DayBucket[]
  recent: DlqEntry[]
  reasonEntries?: DlqEntry[]
  /** How many of the newest DLQ entries the trend was computed from. */
  sampleSize: number
  selectedReason?: FailureReasonCategory | null
  onReasonSelect?: (reason: FailureReasonCategory | null) => void
}

/**
 * At-a-glance DLQ health: counts from `GET metrics`, a per-day trend and the
 * latest entries from `GET dlq`.
 */
export function DlqMetricsPanel({ metrics, trend, recent, reasonEntries = recent, sampleSize, selectedReason = null, onReasonSelect }: DlqMetricsPanelProps) {
  const { t } = useTranslation()
  const summary = summarizeMetrics(metrics)
  const peak = Math.max(1, ...trend.map((bucket) => bucket.count))
  const rate = summary.failureRate === null ? '—' : `${(summary.failureRate * 100).toFixed(1)}%`
  const reasons = groupFailureReasons(reasonEntries)

  return (
    <section aria-label={t('dlq.metrics.title')} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t('dlq.metrics.dlqSize')} value={String(summary.dlq)} />
        <StatCard label={t('dlq.metrics.inFlight')} value={String(summary.inFlight)} />
        <StatCard label={t('dlq.metrics.failureRate')} value={rate} />
        <StatCard label={t('dlq.metrics.total')} value={String(summary.total)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <article className="rounded-xl border border-white/10 bg-slate-800/70 p-4">
          <h2 className="text-sm font-medium text-slate-300">{t('dlq.metrics.trendTitle')}</h2>
          <p className="mt-1 text-xs text-slate-500">{t('dlq.metrics.trendNote', { count: sampleSize })}</p>
          <ol className="mt-4 flex h-32 items-end gap-2" aria-label={t('dlq.metrics.trendTitle')}>
            {trend.map((bucket) => {
              const label = new Date(bucket.day).toISOString().slice(5, 10)
              return (
                <li key={bucket.day} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                  <span className="text-xs text-slate-300">{bucket.count}</span>
                  <span
                    aria-hidden="true"
                    className="w-full rounded-t bg-amber-400/80"
                    style={{ height: `${(bucket.count / peak) * 100}%`, minHeight: bucket.count ? 4 : 1 }}
                  />
                  <span className="text-[10px] text-slate-500">{label}</span>
                </li>
              )
            })}
          </ol>
        </article>

        <article className="rounded-xl border border-white/10 bg-slate-800/70 p-4">
          <h2 className="text-sm font-medium text-slate-300">{t('dlq.metrics.reasonsTitle')}</h2>
          {reasons.length === 0 ? (
            <p className="mt-3 text-sm text-slate-400">{t('dlq.empty')}</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {reasons.map((group) => (
                <li key={group.reason}>
                  <button
                    type="button"
                    onClick={() => onReasonSelect?.(selectedReason === group.reason ? null : group.reason)}
                    className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm transition ${selectedReason === group.reason ? 'bg-cyan-500/20 text-cyan-200' : 'text-slate-300 hover:bg-white/5'}`}
                  >
                    <span>{t(`dlq.reasons.${group.reason}`)}</span>
                    <span className="text-xs text-slate-400">{group.count} · {(group.share * 100).toFixed(1)}%</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="rounded-xl border border-white/10 bg-slate-800/70 p-4">
          <h2 className="text-sm font-medium text-slate-300">{t('dlq.metrics.recentTitle')}</h2>
          {recent.length === 0 ? (
            <p className="mt-3 text-sm text-slate-400">{t('dlq.empty')}</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {recent.map((entry) => (
                <li key={entry.retryId} className="flex flex-col gap-0.5 text-sm">
                  <span className="text-slate-200">
                    {t('dlq.metrics.recentItem', { tx: entry.transactionId, id: shortId(entry.retryId) })}
                  </span>
                  <span className="truncate text-xs text-slate-500" title={entry.lastError ?? undefined}>
                    {formatUtc(entry.createdAt)} · {entry.lastError || t('dlq.noError')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </article>
      </div>
    </section>
  )
}
