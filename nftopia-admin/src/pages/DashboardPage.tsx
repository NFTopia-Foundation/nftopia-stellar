import { useCallback, useEffect, useMemo, useState, useContext } from 'react'
import { useTranslation } from 'react-i18next'
import { AuthContext } from '../auth/useAuth'
import { createAuthorizedFetch } from '../auth/authorizedFetch'
import {
  createPlatformMetricsApi,
  PlatformMetricsApiError,
  type PlatformMetrics,
  type PlatformMetricsApi,
  type TimeRange,
} from '../metrics/platformMetricsApi'
import { PlatformMetricsPanel } from '../components/PlatformMetricsPanel'

export interface DashboardPageProps {
  api?: PlatformMetricsApi
}

/**
 * Dashboard overview page — default post-login landing route.
 * Replaces static placeholders with real-time data-bound metrics (users, listings, volume, active auctions),
 * responsive time-range filtering, and graceful loading/error states.
 *
 * Time Complexity: O(1) state updates and render
 * Space Complexity: O(1) fixed scalar metrics storage
 */
export default function DashboardPage({ api: customApi }: DashboardPageProps) {
  const { t } = useTranslation()
  const authStore = useContext(AuthContext)

  const api = useMemo(() => {
    if (customApi) return customApi
    if (!authStore) {
      throw new Error('DashboardPage requires AuthProvider or an explicit api prop')
    }
    return createPlatformMetricsApi(createAuthorizedFetch(authStore))
  }, [customApi, authStore])

  const [timeRange, setTimeRange] = useState<TimeRange>('24h')
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadMetrics = useCallback(
    async (targetRange: TimeRange) => {
      setLoading(true)
      setError(null)
      try {
        const data = await api.getMetrics(targetRange)
        setMetrics(data)
      } catch (err) {
        if (err instanceof PlatformMetricsApiError) {
          setError(err.status === 0 ? t('dashboard.error.network') : err.message)
        } else {
          setError(t('dashboard.error.load'))
        }
      } finally {
        setLoading(false)
      }
    },
    [api, t],
  )

  useEffect(() => {
    let active = true

    async function execute() {
      setLoading(true)
      setError(null)
      try {
        const data = await api.getMetrics(timeRange)
        if (active) {
          setMetrics(data)
        }
      } catch (err) {
        if (active) {
          if (err instanceof PlatformMetricsApiError) {
            setError(err.status === 0 ? t('dashboard.error.network') : err.message)
          } else {
            setError(t('dashboard.error.load'))
          }
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void execute()

    return () => {
      active = false
    }
  }, [api, timeRange, t])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
          NFTopia Admin
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-white md:text-3xl">
          {t('dashboard.title')}
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          {t('dashboard.subtitle')}
        </p>
      </div>

      <PlatformMetricsPanel
        metrics={metrics}
        timeRange={timeRange}
        onTimeRangeChange={setTimeRange}
        onRefresh={() => void loadMetrics(timeRange)}
        loading={loading}
        error={error}
      />
    </div>
  )
}
