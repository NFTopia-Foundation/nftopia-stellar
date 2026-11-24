import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { API_BASE_URL } from '../auth/authApi'
import { createAuthorizedFetch } from '../auth/authorizedFetch'
import { useAuth } from '../auth/useAuth'
import { DataTable, type Column } from '../components/DataTable'

const PAGE_SIZE = 50

interface AuditLog {
  id: string
  adminId: string
  action: string
  entityType?: string
  entityId?: string
  createdAt: string
  ipAddress?: string
}

interface AuditPage {
  logs: AuditLog[]
  total: number
}

const ACTIONS = ['BAN_USER', 'UNBAN_USER', 'HIDE_COLLECTION', 'VERIFY_COLLECTION', 'FLAG_CONTENT', 'REVIEW_CONTENT_FLAG', 'DISMISS_CONTENT_FLAG', 'RECONCILE_TRANSACTION']

function unwrap(body: unknown): AuditPage {
  let current = body as Record<string, unknown> | undefined
  while (current && 'data' in current && typeof current.data === 'object' && current.data) {
    current = current.data as Record<string, unknown>
  }
  return { logs: Array.isArray(current?.logs) ? current.logs as AuditLog[] : [], total: typeof current?.total === 'number' ? current.total : 0 }
}

export default function AuditLogsPage() {
  const { t } = useTranslation()
  const { store } = useAuth()
  const api = useMemo(() => createAuthorizedFetch(store), [store])
  const [params, setParams] = useSearchParams()
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [adminId, setAdminId] = useState(params.get('adminId') ?? '')
  const [action, setAction] = useState(params.get('action') ?? '')
  const [entityType, setEntityType] = useState(params.get('entityType') ?? '')
  const [entityId, setEntityId] = useState(params.get('entityId') ?? '')
  const [startDate, setStartDate] = useState(params.get('startDate') ?? '')
  const [endDate, setEndDate] = useState(params.get('endDate') ?? '')
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1)

  useEffect(() => {
    const next = new URLSearchParams()
    if (adminId.trim()) next.set('adminId', adminId.trim())
    if (action) next.set('action', action)
    if (entityType.trim()) next.set('entityType', entityType.trim())
    if (entityId.trim()) next.set('entityId', entityId.trim())
    if (startDate) next.set('startDate', startDate)
    if (endDate) next.set('endDate', endDate)
    setParams(next, { replace: true })
  }, [adminId, action, entityType, entityId, startDate, endDate])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const query = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String((page - 1) * PAGE_SIZE) })
      for (const [key, value] of [['adminId', adminId], ['action', action], ['entityType', entityType], ['entityId', entityId]] as const) {
        if (value.trim()) query.set(key, value.trim())
      }
      if (startDate) query.set('startDate', `${startDate}T00:00:00.000Z`)
      if (endDate) query.set('endDate', `${endDate}T23:59:59.999Z`)
      const response = await api(`${API_BASE_URL}/admin/audit-logs?${query}`)
      if (!response.ok) throw new Error(String(response.status))
      const pageData = unwrap(await response.json())
      setLogs(pageData.logs)
      setTotal(pageData.total)
    } catch {
      setError(t('auditLogs.error.load'))
    } finally {
      setLoading(false)
    }
  }, [api, adminId, action, entityType, entityId, startDate, endDate, page, t])

  useEffect(() => {
    void load()
  }, [load])

  const adminOptions = [...new Set(logs.map((log) => log.adminId).filter(Boolean))]
  const columns: Column<AuditLog>[] = [
    { key: 'createdAt', header: t('auditLogs.columns.created'), sortable: true },
    { key: 'adminId', header: t('auditLogs.columns.admin'), sortable: true },
    { key: 'action', header: t('auditLogs.columns.action'), sortable: true },
    { key: 'entityType', header: t('auditLogs.columns.entityType'), sortable: true },
    { key: 'entityId', header: t('auditLogs.columns.entityId') },
  ]
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <section aria-label={t('auditLogs.title')} className="flex flex-col gap-6">
      <header><h1 className="text-2xl font-semibold text-white">{t('auditLogs.title')}</h1><p className="mt-1 text-sm text-slate-400">{t('auditLogs.description')}</p></header>
      <div className="grid gap-3 rounded-xl border border-white/10 bg-slate-900/40 p-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-sm text-slate-300">{t('auditLogs.filters.admin')}<input list="audit-admin-options" value={adminId} onChange={(event) => setAdminId(event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2" /></label>
        <datalist id="audit-admin-options">{adminOptions.map((id) => <option key={id} value={id} />)}</datalist>
        <label className="text-sm text-slate-300">{t('auditLogs.filters.action')}<select value={action} onChange={(event) => setAction(event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2"><option value="">{t('auditLogs.filters.allActions')}</option>{ACTIONS.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        <label className="text-sm text-slate-300">{t('auditLogs.filters.entityType')}<input value={entityType} onChange={(event) => setEntityType(event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2" /></label>
        <label className="text-sm text-slate-300">{t('auditLogs.filters.entityId')}<input value={entityId} onChange={(event) => setEntityId(event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2" /></label>
        <label className="text-sm text-slate-300">{t('auditLogs.filters.startDate')}<input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2" /></label>
        <label className="text-sm text-slate-300">{t('auditLogs.filters.endDate')}<input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2" /></label>
      </div>
      <DataTable<AuditLog> ariaLabel={t('auditLogs.title')} columns={columns} data={logs} keyExtractor={(log) => log.id} loading={loading} error={error} emptyMessage={t('auditLogs.empty')} />
      {pages > 1 ? <nav aria-label={t('auditLogs.pagination.label')} className="flex items-center justify-end gap-2 text-sm text-slate-400"><button type="button" disabled={page <= 1} onClick={() => setParams({ ...Object.fromEntries(params), page: String(page - 1) })} className="rounded-md border border-white/10 px-2 py-1 disabled:opacity-50">{t('auditLogs.pagination.previous')}</button><span>{t('auditLogs.pagination.status', { page, pages })}</span><button type="button" disabled={page >= pages} onClick={() => setParams({ ...Object.fromEntries(params), page: String(page + 1) })} className="rounded-md border border-white/10 px-2 py-1 disabled:opacity-50">{t('auditLogs.pagination.next')}</button></nav> : null}
    </section>
  )
}
