import { useTranslation } from 'react-i18next'
import { StatCard } from './Card'
import type { PlatformMetrics, TimeRange } from '../metrics/platformMetricsApi'
import { formatCount, formatVolume } from '../metrics/formatMetrics'

export interface PlatformMetricsPanelProps {
  metrics: PlatformMetrics | null
  timeRange: TimeRange
  onTimeRangeChange: (range: TimeRange) => void
  onRefresh: () => void
  loading: boolean
  error: string | null
}

/**
 * Top-level platform metrics presentation panel:
 * Displays real platform stats (users, listings, volume, active auctions),
 * time-range controls, and loading/error states.
 *
 * Time Complexity: O(1)
 * Space Complexity: O(1)
 */
export function PlatformMetricsPanel({
  metrics,
  timeRange,
  onTimeRangeChange,
  onRefresh,
  loading,
  error,
}: PlatformMetricsPanelProps) {
  const { t } = useTranslation()

  const rangeLabel = t(`dashboard.timeRange.${timeRange}`)

  return (
    <section aria-label={t('dashboard.title')} className="flex flex-col gap-6">
      {/* Controls Bar: Time Range Selector & Refresh */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/10 bg-slate-800/70 p-4">
        <div>
          <h2 className="text-base font-medium text-white">{t('dashboard.title')}</h2>
          <p className="mt-0.5 text-xs text-slate-400">{t('dashboard.subtitle')}</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label htmlFor="platform-time-range" className="text-xs font-medium text-slate-300">
              {t('dashboard.timeRange.label')}:
            </label>
            <select
              id="platform-time-range"
              value={timeRange}
              disabled={loading}
              onChange={(e) => onTimeRangeChange(e.target.value as TimeRange)}
              className="rounded-lg border border-white/10 bg-slate-900/90 px-3 py-1.5 text-xs font-medium text-white outline-none focus:border-cyan-400 disabled:opacity-50"
            >
              <option value="24h">{t('dashboard.timeRange.24h')}</option>
              <option value="7d">{t('dashboard.timeRange.7d')}</option>
              <option value="30d">{t('dashboard.timeRange.30d')}</option>
              <option value="all">{t('dashboard.timeRange.all')}</option>
            </select>
          </div>

          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            aria-label={t('dashboard.actions.refresh')}
            className="rounded-lg border border-white/10 bg-slate-700/60 px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-700 hover:text-white focus:outline-none focus:ring-1 focus:ring-cyan-400 disabled:opacity-50"
          >
            {loading ? t('dashboard.loading') : t('dashboard.actions.refresh')}
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={onRefresh}
            className="rounded-lg border border-rose-500/30 bg-rose-500/20 px-3 py-1 text-xs font-medium text-rose-100 hover:bg-rose-500/30"
          >
            {t('dashboard.actions.retry')}
          </button>
        </div>
      )}

      {/* Stat Cards Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          testId="stat-total-users"
          label={t('dashboard.metrics.totalUsers')}
          value={formatCount(metrics?.totalUsers)}
          subtext={t('dashboard.subtext.users')}
          loading={loading && !metrics}
        />
        <StatCard
          testId="stat-total-listings"
          label={t('dashboard.metrics.totalListings')}
          value={formatCount(metrics?.totalListings)}
          subtext={t('dashboard.subtext.listings')}
          loading={loading && !metrics}
        />
        <StatCard
          testId="stat-volume"
          label={t('dashboard.metrics.volume', { range: rangeLabel })}
          value={formatVolume(metrics?.volume, metrics?.currency)}
          subtext={t('dashboard.subtext.volume')}
          loading={loading && !metrics}
        />
        <StatCard
          testId="stat-active-auctions"
          label={t('dashboard.metrics.activeAuctions')}
          value={formatCount(metrics?.activeAuctions)}
          subtext={t('dashboard.subtext.auctions')}
          loading={loading && !metrics}
        />
      </div>

      {/* Accessible Loading Announcer */}
      {loading && (
        <div role="status" aria-live="polite" className="sr-only">
          {t('dashboard.loading')}
        </div>
      )}
    </section>
  )
}
