import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { API_BASE_URL } from '../auth/authApi'
import { createAuthorizedFetch } from '../auth/authorizedFetch'
import { useAuth } from '../auth/useAuth'
import ResolveFlagDialog, {
  type ResolveFlagPayload,
  type ResolutionOutcome,
} from '../components/ResolveFlagDialog'

/** A `content_flags` row as returned by `GET /admin/ai/flags`. */
interface ContentFlag {
  id: string
  entityType: string
  entityId: string
  reason: string
  severity: string
  confidence: number
  status: string
  createdAt: string
}

interface FlagsPage {
  flags: ContentFlag[]
  total: number
}

/**
 * The dialog speaks moderator language (approve/reject/dismiss) while
 * `ResolveContentFlagDto` accepts `reviewed` or `dismissed`. Approving and
 * rejecting both mean "a human reviewed this flag", so both map to `reviewed`.
 */
function outcomeToStatus(outcome: ResolutionOutcome): 'reviewed' | 'dismissed' {
  return outcome === 'dismiss' ? 'dismissed' : 'reviewed'
}

/** The API may wrap the payload in `{ data: ... }`, matching the auth client. */
function unwrap(body: unknown): FlagsPage {
  const candidate = body as FlagsPage | { data: FlagsPage }
  return 'flags' in candidate ? candidate : candidate.data
}

/**
 * Queue of AI-raised content flags. Each row (or a multi-row selection) is
 * resolved through the confirmation-gated ResolveFlagDialog, which is wired to
 * the backend's `PATCH /admin/ai/flags/:id` resolve endpoint.
 */
export default function ContentFlagsQueuePage() {
  const { t } = useTranslation()
  const { store } = useAuth()
  const api = useMemo(() => createAuthorizedFetch(store), [store])

  const [flags, setFlags] = useState<ContentFlag[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogTarget, setDialogTarget] = useState<ContentFlag | null>(null)
  const [bulk, setBulk] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await api(`${API_BASE_URL}/admin/ai/flags?status=pending`)
      if (!response.ok) {
        throw new Error(String(response.status))
      }
      const page = unwrap(await response.json())
      setFlags(page.flags ?? [])
      setSelected([])
      setError(null)
    } catch {
      setError(t('contentFlags.error.load'))
    } finally {
      setLoading(false)
    }
  }, [api, t])

  useEffect(() => {
    void load()
  }, [load])

  const resolveFlag = useCallback(
    async (flag: ContentFlag, payload: ResolveFlagPayload) => {
      const response = await api(`${API_BASE_URL}/admin/ai/flags/${flag.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: outcomeToStatus(payload.outcome),
          ...(payload.reason ? { reason: payload.reason } : {}),
        }),
      })
      if (!response.ok) {
        throw new Error(String(response.status))
      }
    },
    [api],
  )

  const openSingle = (flag: ContentFlag) => {
    setDialogTarget(flag)
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

  const handleSubmit = async (payload: ResolveFlagPayload) => {
    setSubmitting(true)
    setError(null)
    try {
      if (bulk) {
        const targets = flags.filter((flag) => selected.includes(flag.id))
        const results = await Promise.allSettled(
          targets.map((flag) => resolveFlag(flag, payload)),
        )
        if (results.some((result) => result.status === 'rejected')) {
          setError(t('contentFlags.error.bulkResolve'))
        }
      } else if (dialogTarget) {
        await resolveFlag(dialogTarget, payload)
      }
      setDialogOpen(false)
      setDialogTarget(null)
      setBulk(false)
      await load()
    } catch {
      setError(t('contentFlags.error.resolve'))
    } finally {
      setSubmitting(false)
    }
  }

  const toggleSelected = (id: string) => {
    setSelected((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    )
  }

  return (
    <section aria-label={t('contentFlags.title')} className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">{t('contentFlags.title')}</h1>
          <p className="mt-1 text-sm text-slate-400">{t('contentFlags.description')}</p>
        </div>
        <button
          type="button"
          onClick={openBulk}
          disabled={selected.length === 0}
          className="rounded-lg bg-cyan-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-cyan-500 disabled:opacity-50"
        >
          {t('contentFlags.actions.bulkResolve')} ({selected.length})
        </button>
      </header>

      {error ? (
        <p role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : flags.length === 0 ? (
        <p className="text-sm text-slate-400">{t('contentFlags.empty')}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-white/5 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th scope="col" className="px-3 py-2">{t('contentFlags.columns.select')}</th>
                <th scope="col" className="px-3 py-2">{t('contentFlags.columns.item')}</th>
                <th scope="col" className="px-3 py-2">{t('contentFlags.columns.reason')}</th>
                <th scope="col" className="px-3 py-2">{t('contentFlags.columns.confidence')}</th>
                <th scope="col" className="px-3 py-2">{t('contentFlags.columns.created')}</th>
                <th scope="col" className="px-3 py-2">{t('contentFlags.columns.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {flags.map((flag) => (
                <tr key={flag.id} className="border-t border-white/10">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      aria-label={`${t('contentFlags.columns.select')} ${flag.id}`}
                      checked={selected.includes(flag.id)}
                      onChange={() => toggleSelected(flag.id)}
                    />
                  </td>
                  <td className="px-3 py-2 text-slate-300">
                    {flag.entityType}:{flag.entityId}
                  </td>
                  <td className="px-3 py-2 text-slate-300">{flag.reason}</td>
                  <td className="px-3 py-2 text-slate-300">{flag.confidence}</td>
                  <td className="px-3 py-2 text-slate-400">{flag.createdAt}</td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => openSingle(flag)}
                      className="rounded-md border border-white/10 px-2 py-1 text-xs text-slate-200 transition hover:bg-white/10"
                    >
                      {t('contentFlags.actions.resolve')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ResolveFlagDialog
        open={dialogOpen}
        flagId={dialogTarget?.id}
        flagCount={bulk ? selected.length : 1}
        submitting={submitting}
        error={error}
        onClose={closeDialog}
        onSubmit={handleSubmit}
      />
    </section>
  )
}
