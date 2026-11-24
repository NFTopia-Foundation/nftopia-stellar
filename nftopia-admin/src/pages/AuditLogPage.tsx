import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { API_BASE_URL } from '../auth/authApi'
import { createAuthorizedFetch } from '../auth/authorizedFetch'
import { useAuth } from '../auth/useAuth'
import { DataTable, type Column } from '../components/DataTable'

const PAGE_SIZE = 50

interface AuditEntry {
  id: string
  adminId: string
  action: string
  entityType?: string
  entityId?: string
  createdAt: string
  ipAddress?: string
  userAgent?: string
}

function unwrap(body: unknown): { logs: AuditEntry[]; total: number } {
  let current = body as Record<string, unknown> | undefined
  while (current && 'data' in current && typeof current.data === 'object' && current.data) {
    current = current.data as Record<string, unknown>
  }
  return {
    logs: Array.isArray(current?.logs) ? current.logs as AuditEntry[] : [],
    total: typeof current?.total === 'number' ? current.total : 0,
  }
}

export default function AuditLogPage() {
  const { t } = useTranslation()
  const { store } = useAuth()
  const api = useMemo(() => createAuthorizedFetch(store), [store])
  const [logs, setLogs] = useState<AuditEntry[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const query = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) })
      const response = await api(`${API_BASE_URL}/admin/audit-logs?${query}`)
      if (!response.ok) throw new Error(String(response.status))
      const page = unwrap(await response.json())
      setLogs(page.logs)
      setTotal(page.total)
    } catch {
      setError(t('auditLog.error.load'))
    } finally {
      setLoading(false)
    }
  }, [api, offset, t])

  useEffect(() => { void load() }, [load])

  const targetLink = (entry: AuditEntry) => {
    if (!entry.entityId) return '—'
    const entity = entry.entityType?.toLowerCase()
    if (entity === 'user') return <Link to={`/users?selected=${encodeURIComponent(entry.entityId)}`} className="text-cyan-300 hover:underline">{entry.entityId}</Link>
    if (entity === 'collection') return <Link to={`/collections?selected=${encodeURIComponent(entry.entityId)}`} className="text-cyan-300 hover:underline">{entry.entityId}</Link>
    return entry.entityId
  }

  const columns: Column<AuditEntry>[] = [
    { key: 'createdAt', header: t('auditLog.columns.created'), sortable: true },
    { key: 'adminId', header: t('auditLog.columns.actor'), sortable: true },
    { key: 'action', header: t('auditLog.columns.action'), sortable: true },
    { key: 'entityType', header: t('auditLog.columns.entity'), render: (entry) => targetLink(entry) },
    { key: 'ipAddress', header: t('auditLog.columns.ip') },
    { key: 'userAgent', header: t('auditLog.columns.userAgent') },
  ]
  const page = Math.floor(offset / PAGE_SIZE) + 1
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <section aria-label={t('auditLog.title')} className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold text-white">{t('auditLog.title')}</h1>
        <p className="mt-1 text-sm text-slate-400">{t('auditLog.description')}</p>
      </header>
      <DataTable<AuditEntry>
        ariaLabel={t('auditLog.title')}
        columns={columns}
        data={logs}
        keyExtractor={(entry) => entry.id}
        loading={loading}
        error={error}
        emptyMessage={t('auditLog.empty')}
      />
      {pages > 1 ? (
        <nav aria-label={t('auditLog.pagination.label')} className="flex items-center justify-end gap-2 text-sm text-slate-400">
          <button type="button" disabled={offset === 0} onClick={() => setOffset((value) => Math.max(0, value - PAGE_SIZE))} className="rounded-md border border-white/10 px-2 py-1 disabled:opacity-50">{t('auditLog.pagination.previous')}</button>
          <span>{t('auditLog.pagination.status', { page, pages })}</span>
          <button type="button" disabled={page >= pages} onClick={() => setOffset((value) => value + PAGE_SIZE)} className="rounded-md border border-white/10 px-2 py-1 disabled:opacity-50">{t('auditLog.pagination.next')}</button>
        </nav>
      ) : null}
    </section>
  )
}
