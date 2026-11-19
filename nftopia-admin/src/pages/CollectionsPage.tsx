import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { API_BASE_URL } from '../auth/authApi'
import { createAuthorizedFetch } from '../auth/authorizedFetch'
import { useAuth } from '../auth/useAuth'
 import ResolveVerificationDialog from '../components/ResolveVerificationDialog'

/** A collection verification row as returned by `GET /admin/verifications`. */
interface CollectionVerification {
  id: string
  collectionId: string
  entityType: string
  reason: string
  severity: string
  confidence: number
  status: 'pending' | 'approved' | 'rejected'
  createdAt: string
  name: string
  description: string
  imageUrl: string
}

interface VerificationPage {
  verifications: CollectionVerification[]
  total: number
}

const PAGE_SIZE = 50

function unwrap(body: unknown): VerificationPage {
  let candidate = body as Record<string, unknown> | null
  while (candidate && typeof candidate === 'object' && 'data' in candidate && !('verifications' in candidate)) {
    candidate = candidate.data as Record<string, unknown> | null
  }
  if (!candidate || !Array.isArray(candidate.verifications)) {
    throw new Error('Invalid collection verifications response')
  }
  return candidate as unknown as VerificationPage
}

function unwrapEntity(body: unknown): Record<string, unknown> {
  let current = body as Record<string, unknown> | null
  while (current && typeof current === 'object' && 'data' in current && !('id' in current)) {
    current = current.data as Record<string, unknown> | null
  }
  return current ?? {}
}

function previewFromEntity(entity: Record<string, unknown>): {
  title?: string
  description?: string
  imageUrl?: string
} {
  return {
    title: typeof entity.name === 'string' ? entity.name : undefined,
    description: typeof entity.description === 'string' ? entity.description : undefined,
    imageUrl: typeof entity.imageUrl === 'string' ? entity.imageUrl : undefined,
  }
}

export default function CollectionsPage() {
  const { t } = useTranslation()
  const { store } = useAuth()
  const api = useMemo(() => createAuthorizedFetch(store), [store])

  const [verifications, setVerifications] = useState<CollectionVerification[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [previews, setPreviews] = useState<Record<string, { title?: string; description?: string; imageUrl?: string }>>({})
  const [statusFilter, setStatusFilter] = useState<'pending' | 'approved' | 'rejected'>('pending')
  const [selected, setSelected] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogTarget, setDialogTarget] = useState<CollectionVerification | null>(null)
  const [bulk, setBulk] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const query = new URLSearchParams({ status: statusFilter, limit: String(PAGE_SIZE), offset: String(offset), entityType: 'collection' })
      const response = await api(`${API_BASE_URL}/admin/verifications?${query.toString()}`)
      if (!response.ok) {
        throw new Error(String(response.status))
      }
      const page = unwrap(await response.json())
      setVerifications(page.verifications)
      setTotal(page.total ?? page.verifications.length)
      const details = await Promise.all(
        page.verifications.map(async (ver) => {
          try {
            const detailResponse = await api(`${API_BASE_URL}/collections/${encodeURIComponent(ver.collectionId)}`)
            if (!detailResponse.ok) return [ver.id, {}] as const
            const payload = await detailResponse.json()
            const value = unwrapEntity(payload)
            return [ver.id, previewFromEntity(value)] as const
          } catch {
            return [ver.id, {}] as const
          }
        }),
      )
      setPreviews(Object.fromEntries(details))
      setError(null)
    } catch {
      setError(t('collections.error.load'))
    } finally {
      setLoading(false)
    }
  }, [api, offset, statusFilter, t])

  useEffect(() => {
    void load()
  }, [load])

  const approveVerification = useCallback(
    async (verification: CollectionVerification) => {
      if (!window.confirm(t('collections.confirm.approve', {
        collectionName: verification.name,
      }))) {
        return
      }
      setSubmitting(true)
      try {
        const response = await api(`${API_BASE_URL}/admin/verifications/${verification.id}/approve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        })
        if (!response.ok) {
          throw new Error(String(response.status))
        }
        setDialogOpen(false)
        setDialogTarget(null)
        await load()
      } catch (err: unknown) {
        setError(
          err instanceof Error ? err.message : t('collections.error.approve'),
        )
      } finally {
        setSubmitting(false)
      }
    },
    [api, t],
  )

  const rejectVerification = useCallback(
    async (verification: CollectionVerification, reason: string) => {
      if (!window.confirm(t('collections.confirm.reject', {
        collectionName: verification.name,
      }))) {
        return
      }
      setSubmitting(true)
      try {
        const response = await api(`${API_BASE_URL}/admin/verifications/${verification.id}/reject`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason }),
        })
        if (!response.ok) {
          throw new Error(String(response.status))
        }
        setDialogOpen(false)
        setDialogTarget(null)
        await load()
      } catch (err: unknown) {
        setError(
          err instanceof Error ? err.message : t('collections.error.reject'),
        )
      } finally {
        setSubmitting(false)
      }
    },
    [api, t],
  )

  const openSingle = (verification: CollectionVerification) => {
    setDialogTarget(verification)
    setBulk(false)
    setDialogOpen(true)
  }

  const openBulk = () => {
    setDialogTarget(null)
    setBulk(true)
    setDialogOpen(true)
  }

  const closeDialog = () => {
    if (submitting) return
    setDialogOpen(false)
    setDialogTarget(null)
    setBulk(false)
  }

  const handleSubmit = async (payload: { action: 'approve' | 'reject'; reason?: string }) => {
    setSubmitting(true)
    setError(null)
    try {
      if (bulk) {
        const targets = verifications.filter((ver) => selected.includes(ver.id))
        const results = await Promise.allSettled(
          targets.map((ver) =>
            payload.action === 'approve'
              ? approveVerification(ver)
              : rejectVerification(ver, payload.reason ?? ''),
          ),
        )
        const failedIds = results
          .flatMap((result, index) => (result.status === 'rejected' ? [targets[index].id] : []))
        await load()
        setSelected(failedIds)
        if (failedIds.length > 0) {
          setError(t('collections.error.bulkAction'))
        } else {
          setDialogOpen(false)
          setBulk(false)
        }
      } else if (dialogTarget) {
        if (payload.action === 'approve') {
          await approveVerification(dialogTarget)
        } else {
          await rejectVerification(dialogTarget, payload.reason ?? '')
        }
        setDialogOpen(false)
        setDialogTarget(null)
        await load()
      }
    } catch {
      setError(t('collections.error.resolve'))
    } finally {
      setSubmitting(false)
    }
  }

  const toggleSelected = (id: string) => {
    setSelected((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    )
  }

  const visibleVerifications = statusFilter === 'pending'
    ? verifications
    : verifications.filter((ver) => ver.status === statusFilter)
  const selectedVisibleCount = visibleVerifications.reduce(
    (count, ver) => count + Number(selected.includes(ver.id)),
    0,
  )

  return (
    <section aria-label={t('nav.collections')} className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white md:text-3xl">
            {t('nav.collections')}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            {t('collections.description')}
          </p>
        </div>
        <button
          type="button"
          onClick={openBulk}
          disabled={selectedVisibleCount === 0}
          className="rounded-lg bg-cyan-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-cyan-500 disabled:opacity-50"
        >
          {t('collections.actions.bulkApproveReject')} ({selectedVisibleCount})
        </button>
      </header>

      <div className="flex flex-wrap gap-3">
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <span>{t('collections.filters.status')}</span>
          <select
            aria-label={t('collections.filters.status')}
            value={statusFilter}
            onChange={(event) => {
              setOffset(0)
              setSelected([])
              setStatusFilter(event.target.value as 'pending' | 'approved' | 'rejected')
            }}
            className="rounded-md border border-white/10 bg-slate-900 px-2 py-1 text-white"
          >
            <option value="pending">{t('collections.status.pending')}</option>
            <option value="approved">{t('collections.status.approved')}</option>
            <option value="rejected">{t('collections.status.rejected')}</option>
          </select>
        </label>
      </div>

      {error ? (
        <p role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      ) : null}

      {!loading && total > 0 ? (
        <p className="text-xs text-slate-400">{t('collections.results', { count: total })}</p>
      ) : null}

      {loading && verifications.length === 0 ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : visibleVerifications.length === 0 ? (
        <p className="text-sm text-slate-400">{t('collections.empty')}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-white/5 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th scope="col" className="px-3 py-2">
                  <input
                    type="checkbox"
                    disabled={visibleVerifications.every((ver) => ver.status !== 'pending')}
                    aria-label={t('collections.columns.selectAll')}
                    checked={selectedVisibleCount === visibleVerifications.length}
                    onChange={() => {
                      if (selectedVisibleCount === visibleVerifications.length) {
                        setSelected([])
                      } else {
                        setSelected(
                          visibleVerifications.map((ver) => ver.id),
                        )
                      }
                    }}
                  />
                </th>
                <th scope="col" className="px-3 py-2">{t('collections.columns.item')}</th>
                <th scope="col" className="px-3 py-2">{t('collections.columns.reason')}</th>
                <th scope="col" className="px-3 py-2">{t('collections.columns.severity')}</th>
                <th scope="col" className="px-3 py-2">{t('collections.columns.status')}</th>
                <th scope="col" className="px-3 py-2">{t('collections.columns.created')}</th>
                <th scope="col" className="px-3 py-2">{t('collections.columns.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {visibleVerifications.map((ver) => (
                <tr key={ver.id} className="border-t border-white/10">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      disabled={ver.status !== 'pending'}
                      aria-label={`${t('collections.columns.select')} ${ver.id}`}
                      checked={selected.includes(ver.id)}
                      onChange={() => toggleSelected(ver.id)}
                    />
                  </td>
                  <td className="px-3 py-2 text-slate-300">
                    <span className="block font-medium">{ver.name}</span>
                    <span className="font-mono text-xs text-slate-400">{ver.collectionId}</span>
                    {previews[ver.id]?.imageUrl ? (
                      <img src={previews[ver.id].imageUrl} alt="" loading="lazy" className="mt-2 h-16 w-16 rounded object-cover" />
                    ) : null}
                    {previews[ver.id]?.title ? <span className="mt-1 block font-medium">{previews[ver.id].title}</span> : null}
                    {previews[ver.id]?.description ? <span className="block max-w-xs text-xs text-slate-400">{previews[ver.id].description}</span> : null}
                  </td>
                  <td className="px-3 py-2 text-slate-300">{ver.reason}</td>
                  <td className="px-3 py-2 text-slate-300">{ver.severity}</td>
                  <td className="px-3 py-2 text-slate-300">{t(`collections.status.${ver.status}`)}</td>
                  <td className="px-3 py-2 text-slate-400">{ver.createdAt}</td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => openSingle(ver)}
                      disabled={ver.status !== 'pending'}
                      className="rounded-md border border-white/10 px-2 py-1 text-xs text-slate-200 transition hover:bg-white/10"
                    >
                      {t('collections.actions.view')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && total > PAGE_SIZE ? (
        <nav aria-label={t('collections.pagination.label')} className="flex items-center justify-between text-sm text-slate-300">
          <button type="button" onClick={() => setOffset((current) => Math.max(0, current - PAGE_SIZE))} disabled={offset === 0} className="rounded border border-white/10 px-3 py-1 disabled:opacity-50">{t('collections.pagination.previous')}</button>
          <span>{t('collections.pagination.page', { page: Math.floor(offset / PAGE_SIZE) + 1, pages: Math.ceil(total / PAGE_SIZE) })}</span>
          <button type="button" onClick={() => setOffset((current) => current + PAGE_SIZE)} disabled={offset + PAGE_SIZE >= total} className="rounded border border-white/10 px-3 py-1 disabled:opacity-50">{t('collections.pagination.next')}</button>
        </nav>
      ) : null}

      <ResolveVerificationDialog
        open={dialogOpen}
        verificationId={dialogTarget?.id}
        verificationName={dialogTarget?.name}
        bulk={bulk}
        submitting={submitting}
        error={error}
        onClose={closeDialog}
        onSubmit={handleSubmit}
      />
    </section>
  )
}
