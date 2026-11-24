import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { API_BASE_URL } from '../auth/authApi'
import { createAuthorizedFetch } from '../auth/authorizedFetch'
import { useAuth } from '../auth/useAuth'
import { DataTable, type Column } from '../components/DataTable'
import ConfirmActionDialog from '../components/ConfirmActionDialog'

interface UsageWindow {
  totalTokens: number
  estimatedCostUsd: number
  cap: number
  remaining: number
  spendCapUsd: number | null
  percentUsed: number
  resetsAt: string
}

interface UsageSummary {
  daily: UsageWindow
  monthly: UsageWindow
  hasOverride: boolean
}

interface ToolLog {
  id: string
  userId: string
  sessionId: string
  toolName: string
  durationMs?: number
  success: boolean
  createdAt: string
}

function unwrap<T>(body: unknown): T {
  let current = body as Record<string, unknown> | undefined
  while (current && 'data' in current && typeof current.data === 'object' && current.data && !Array.isArray(current.data)) {
    current = current.data as Record<string, unknown>
  }
  return current as T
}

export default function AiUsagePage() {
  const { t } = useTranslation()
  const { store } = useAuth()
  const api = useMemo(() => createAuthorizedFetch(store), [store])
  const [health, setHealth] = useState<'up' | 'down' | 'unconfigured' | 'loading'>('loading')
  const [userId, setUserId] = useState('')
  const [searchedUserId, setSearchedUserId] = useState('')
  const [usage, setUsage] = useState<UsageSummary | null>(null)
  const [usageLoading, setUsageLoading] = useState(false)
  const [usageError, setUsageError] = useState<string | null>(null)
  const [logs, setLogs] = useState<ToolLog[]>([])
  const [logsLoading, setLogsLoading] = useState(true)
  const [logsError, setLogsError] = useState<string | null>(null)
  const [dialog, setDialog] = useState<'set' | 'clear' | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [overrideError, setOverrideError] = useState<string | null>(null)
  const [dailyTokenCap, setDailyTokenCap] = useState('')
  const [monthlyTokenCap, setMonthlyTokenCap] = useState('')

  const loadHealth = useCallback(async () => {
    try {
      const response = await api(`${API_BASE_URL}/ai/health`)
      if (!response.ok) throw new Error()
      const body = await response.json() as { status?: 'up' | 'down' | 'unconfigured' }
      setHealth(body.status ?? 'down')
    } catch {
      setHealth('down')
    }
  }, [api])

  const loadLogs = useCallback(async () => {
    setLogsLoading(true)
    setLogsError(null)
    try {
      const params = new URLSearchParams({ page: '1', limit: '50' })
      if (searchedUserId) params.set('userId', searchedUserId)
      const response = await api(`${API_BASE_URL}/ai/admin/tool-logs?${params}`)
      if (!response.ok) throw new Error()
      const body = unwrap<{ data?: ToolLog[] }>(await response.json())
      setLogs(body.data ?? [])
    } catch {
      setLogsError(t('aiUsage.error.logs'))
    } finally {
      setLogsLoading(false)
    }
  }, [api, searchedUserId, t])

  useEffect(() => {
    void loadHealth()
  }, [loadHealth])

  useEffect(() => {
    void loadLogs()
  }, [loadLogs])

  const lookupUsage = async (event?: React.FormEvent) => {
    event?.preventDefault()
    const id = userId.trim()
    if (!id) return
    setUsageLoading(true)
    setUsageError(null)
    try {
      const response = await api(`${API_BASE_URL}/ai/admin/usage/${encodeURIComponent(id)}`)
      if (!response.ok) throw new Error()
      setUsage(unwrap<UsageSummary>(await response.json()))
      setSearchedUserId(id)
    } catch {
      setUsage(null)
      setUsageError(t('aiUsage.error.usage'))
    } finally {
      setUsageLoading(false)
    }
  }

  const submitOverride = async () => {
    if (!searchedUserId) return
    setSubmitting(true)
    setOverrideError(null)
    try {
      const body = dialog === 'clear'
        ? null
        : {
            ...(dailyTokenCap ? { dailyTokenCap: Number(dailyTokenCap) } : {}),
            ...(monthlyTokenCap ? { monthlyTokenCap: Number(monthlyTokenCap) } : {}),
          }
      const response = await api(
        `${API_BASE_URL}/ai/admin/usage/${encodeURIComponent(searchedUserId)}/override`,
        dialog === 'clear'
          ? { method: 'DELETE' }
          : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
      )
      if (!response.ok) throw new Error()
      setDialog(null)
      await lookupUsage()
    } catch {
      setOverrideError(t('aiUsage.error.override'))
    } finally {
      setSubmitting(false)
    }
  }

  const columns: Column<ToolLog>[] = [
    { key: 'toolName', header: t('aiUsage.logs.columns.tool'), sortable: true },
    { key: 'userId', header: t('aiUsage.logs.columns.user'), sortable: true },
    { key: 'sessionId', header: t('aiUsage.logs.columns.session') },
    { key: 'success', header: t('aiUsage.logs.columns.status'), render: (row) => row.success ? t('aiUsage.logs.success') : t('aiUsage.logs.failed') },
    { key: 'createdAt', header: t('aiUsage.logs.columns.created'), sortable: true },
  ]

  const healthLabel = health === 'loading' ? t('aiUsage.health.loading') : t(`aiUsage.health.${health}`)

  return (
    <section aria-label={t('aiUsage.title')} className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">{t('aiUsage.title')}</h1>
          <p className="mt-1 text-sm text-slate-400">{t('aiUsage.description')}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${health === 'up' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300'}`}>
          {healthLabel}
        </span>
      </header>

      <article className="rounded-xl border border-white/10 bg-slate-900/40 p-4">
        <h2 className="text-sm font-medium text-slate-300">{t('aiUsage.lookup.title')}</h2>
        <form onSubmit={lookupUsage} className="mt-3 flex flex-wrap gap-2">
          <input
            aria-label={t('aiUsage.lookup.userId')}
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
            placeholder={t('aiUsage.lookup.userId')}
            className="min-w-64 rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          />
          <button type="submit" disabled={usageLoading || !userId.trim()} className="rounded-lg bg-cyan-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">
            {usageLoading ? t('aiUsage.lookup.loading') : t('aiUsage.lookup.submit')}
          </button>
        </form>
        {usageError ? <p role="alert" className="mt-3 text-sm text-red-300">{usageError}</p> : null}
        {usage ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {([['daily', usage.daily], ['monthly', usage.monthly]] as const).map(([period, window]) => (
              <div key={period} className="rounded-lg border border-white/10 p-3">
                <h3 className="text-sm font-semibold text-slate-200">{t(`aiUsage.lookup.${period}`)}</h3>
                <dl className="mt-2 grid grid-cols-2 gap-2 text-sm text-slate-300">
                  <dt>{t('aiUsage.lookup.tokens')}</dt><dd>{window.totalTokens.toLocaleString()}</dd>
                  <dt>{t('aiUsage.lookup.cap')}</dt><dd>{window.cap.toLocaleString()}</dd>
                  <dt>{t('aiUsage.lookup.cost')}</dt><dd>${window.estimatedCostUsd.toFixed(6)}</dd>
                  <dt>{t('aiUsage.lookup.remaining')}</dt><dd>{window.remaining.toLocaleString()}</dd>
                </dl>
              </div>
            ))}
            <div className="flex flex-wrap gap-2 md:col-span-2">
              <button type="button" onClick={() => { setOverrideError(null); setDialog('set') }} className="rounded-lg border border-cyan-500/30 px-3 py-2 text-sm text-cyan-300">
                {t('aiUsage.override.set')}
              </button>
              {usage.hasOverride ? (
                <button type="button" onClick={() => { setOverrideError(null); setDialog('clear') }} className="rounded-lg border border-red-500/30 px-3 py-2 text-sm text-red-300">
                  {t('aiUsage.override.clear')}
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </article>

      <article className="rounded-xl border border-white/10 bg-slate-900/40 p-4">
        <h2 className="text-sm font-medium text-slate-300">{t('aiUsage.aggregate.title')}</h2>
        <p className="mt-2 text-sm text-slate-400">{t('aiUsage.aggregate.dependency')}</p>
      </article>

      <article className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-white">{t('aiUsage.logs.title')}</h2>
        <DataTable<ToolLog>
          ariaLabel={t('aiUsage.logs.title')}
          columns={columns}
          data={logs}
          keyExtractor={(row) => row.id}
          loading={logsLoading}
          error={logsError}
          emptyMessage={t('aiUsage.logs.empty')}
        />
      </article>

      <ConfirmActionDialog
        open={dialog === 'set'}
        title={t('aiUsage.override.setTitle')}
        description={t('aiUsage.override.setDescription')}
        confirmLabel={t('aiUsage.override.set')}
        submitting={submitting}
        error={overrideError}
        confirmDisabled={dailyTokenCap === '' && monthlyTokenCap === ''}
        onConfirm={submitOverride}
        onClose={() => setDialog(null)}
      >
        <label className="block text-sm text-slate-300">{t('aiUsage.override.daily')}<input type="number" min="1" value={dailyTokenCap} onChange={(event) => setDailyTokenCap(event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2" /></label>
        <label className="block text-sm text-slate-300">{t('aiUsage.override.monthly')}<input type="number" min="1" value={monthlyTokenCap} onChange={(event) => setMonthlyTokenCap(event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2" /></label>
      </ConfirmActionDialog>

      <ConfirmActionDialog
        open={dialog === 'clear'}
        title={t('aiUsage.override.clearTitle')}
        description={t('aiUsage.override.clearDescription')}
        confirmLabel={t('aiUsage.override.clear')}
        danger
        submitting={submitting}
        error={overrideError}
        onConfirm={submitOverride}
        onClose={() => setDialog(null)}
      />
    </section>
  )
}
