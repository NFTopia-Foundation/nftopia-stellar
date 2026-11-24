/**
 * Transaction retry / DLQ operations screen (issue #565)
 *
 * Covers the API client against a fake backend that follows the rules of
 * `transaction-retry.controller.ts` and its service, the derived metrics, the
 * typed confirmations, role gating, and server-rendered metrics/list views.
 */

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import '../i18n'
import ConfirmActionDialog from '../components/ConfirmActionDialog'
import { DlqMetricsPanel } from '../components/DlqMetricsPanel'
import { DlqTable } from '../components/DlqTable'
import { canManageDlq, DLQ_ROLES } from '../dlq/access'
import {
  createDlqApi,
  DlqApiError,
  toEpochMs,
  unwrapPayload,
  type DlqEntry,
  type RetryMetrics,
  type RetryStatus,
} from '../dlq/dlqApi'
import {
  bucketByDay,
  bulkRetryPhrase,
  cleanupPhrase,
  confirmationMatches,
  recentActivity,
  summarizeMetrics,
} from '../dlq/dlqStats'
import { formatUtc } from '../dlq/format'
import enJson from '../locales/en.json'
import esJson from '../locales/es.json'

const BASE = 'http://api.test/api/v1'
const NOW = Date.UTC(2026, 9, 16, 12, 0, 0)
const DAY = 24 * 60 * 60 * 1000

function entry(n: number, overrides: Partial<DlqEntry> = {}): DlqEntry {
  return {
    id: `row-${n}`,
    retryId: `0000000${n}-aaaa-bbbb-cccc-dddddddddddd`,
    transactionId: 100 + n,
    contractTxId: `contract-tx-${n}`,
    status: 'dlq',
    attemptCount: 5,
    maxAttempts: 5,
    lastError: `tx_bad_seq #${n}`,
    // Postgres bigint columns arrive as strings.
    createdAt: String(NOW - n * DAY),
    ...overrides,
  }
}

// ── Fake backend ──────────────────────────────────────────────────────────────

interface Call {
  method: string
  path: string
  body?: unknown
}

/**
 * In-memory stand-in for the transaction-retry routes. Mirrors the service:
 * DLQ list is newest first, only `dlq` rows can be retried, `dlq` and
 * `completed` rows can't be cancelled, and bulk retry takes the first `limit`.
 * Responses are wrapped the way StellarResponseInterceptor may wrap them.
 */
function fakeBackend(rows: DlqEntry[], { wrap = true } = {}) {
  const store = rows.map((row) => ({ ...row }))
  const calls: Call[] = []

  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(wrap && status < 400 ? { ok: true, data: body, stellarMeta: {} } : body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })

  const dlqRows = () =>
    store
      .filter((row) => row.status === 'dlq')
      .sort((a, b) => (toEpochMs(b.createdAt) ?? 0) - (toEpochMs(a.createdAt) ?? 0))

  function retry(retryId: string) {
    const row = store.find((r) => r.retryId === retryId && r.status === 'dlq')
    if (!row) throw new Error(`DLQ entry ${retryId} not found or not in DLQ status`)
    Object.assign(row, { status: 'pending' as RetryStatus, attemptCount: 0, lastError: undefined })
    return row
  }

  const fetchImpl = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input))
    const path = url.pathname.replace('/api/v1/transaction-retry', '')
    const method = init.method ?? 'GET'
    const body = init.body ? JSON.parse(String(init.body)) : undefined
    calls.push({ method, path: `${path}${url.search}`, body })

    if (method === 'GET' && path === '/metrics') {
      const count = (status: RetryStatus) => store.filter((r) => r.status === status).length
      const m = {
        pending: count('pending'),
        processing: count('processing'),
        completed: count('completed'),
        failed: count('failed'),
        cancelled: count('cancelled'),
        dlq: count('dlq'),
      }
      return json(200, { ...m, total: Object.values(m).reduce((a, b) => a + b, 0) })
    }
    if (method === 'GET' && path === '/dlq') {
      const page = Number(url.searchParams.get('page') ?? 1)
      const limit = Number(url.searchParams.get('limit') ?? 20)
      const all = dlqRows()
      return json(200, { data: all.slice((page - 1) * limit, page * limit), page, limit, total: all.length })
    }
    const single = path.match(/^\/dlq\/([^/]+)\/retry$/)
    if (method === 'POST' && single) {
      try {
        const row = retry(decodeURIComponent(single[1]))
        return json(201, { message: 'DLQ entry re-enqueued for retry', reason: body?.reason, data: row })
      } catch (error) {
        return json(500, { statusCode: 500, message: (error as Error).message })
      }
    }
    if (method === 'POST' && path === '/dlq/bulk-retry') {
      const targets = dlqRows().slice(0, body?.limit || 50)
      const results = targets.map((row) => ({ retryId: row.retryId, success: true, data: retry(row.retryId) }))
      return json(201, { message: `Bulk retry initiated for ${results.length} DLQ entries`, results })
    }
    const cleanup = path.match(/^\/cleanup\/(\d+)$/)
    if (method === 'DELETE' && cleanup) {
      return json(200, { message: `Cleanup for retries older than ${cleanup[1]} days` })
    }
    const cancel = path.match(/^\/([^/]+)$/)
    if (method === 'DELETE' && cancel) {
      const row = store.find((r) => r.retryId === decodeURIComponent(cancel[1]))
      if (!row) return json(500, { statusCode: 500, message: `Retry ${cancel[1]} not found` })
      if (row.status === 'dlq') {
        return json(500, { statusCode: 500, message: 'Cannot cancel a DLQ entry; use retryDlqEntry to retry' })
      }
      row.status = 'cancelled'
      return new Response(null, { status: 204 })
    }
    return json(404, { statusCode: 404, message: 'Not Found' })
  })

  return { api: createDlqApi(fetchImpl as unknown as typeof fetch, BASE), calls, store, fetchImpl }
}

// ── Metrics ───────────────────────────────────────────────────────────────────

describe('metrics', () => {
  it('reads counts through the response envelope', async () => {
    const { api, calls } = fakeBackend([entry(1), entry(2), entry(3, { status: 'completed' })])
    const metrics = await api.getMetrics()
    expect(calls[0]).toEqual({ method: 'GET', path: '/metrics', body: undefined })
    expect(metrics).toMatchObject({ dlq: 2, completed: 1, total: 3 })
  })

  it('reads an unwrapped payload the same way', async () => {
    const { api } = fakeBackend([entry(1)], { wrap: false })
    expect((await api.getMetrics()).dlq).toBe(1)
  })

  it('summarizes DLQ size, in-flight retries and failure rate', () => {
    const metrics: RetryMetrics = { pending: 2, processing: 1, completed: 6, failed: 1, cancelled: 4, dlq: 3, total: 17 }
    expect(summarizeMetrics(metrics)).toEqual({ dlq: 3, inFlight: 3, failureRate: 0.4, total: 17 })
  })

  it('has no failure rate before anything finished', () => {
    const empty: RetryMetrics = { pending: 1, processing: 0, completed: 0, failed: 0, cancelled: 0, dlq: 0, total: 1 }
    expect(summarizeMetrics(empty).failureRate).toBeNull()
  })

  it('buckets entries per UTC day, oldest first, with empty days kept', () => {
    const rows = [entry(0), entry(0), entry(2), entry(6), entry(7), entry(1, { createdAt: 'not-a-number' })]
    const buckets = bucketByDay(rows, NOW, 7)
    expect(buckets).toHaveLength(7)
    expect(buckets.map((b) => b.count)).toEqual([1, 0, 0, 0, 1, 0, 2])
    expect(new Date(buckets[6].day).toISOString()).toBe('2026-10-16T00:00:00.000Z')
  })

  it('lists recent activity newest first', () => {
    const rows = [entry(3), entry(1), entry(2)]
    expect(recentActivity(rows, 2).map((r) => r.transactionId)).toEqual([101, 102])
  })

  it('renders the metrics view with counts, trend and recent entries', () => {
    const metrics: RetryMetrics = { pending: 2, processing: 1, completed: 6, failed: 1, cancelled: 4, dlq: 3, total: 17 }
    const rows = [entry(0), entry(1)]
    const html = renderToStaticMarkup(
      createElement(DlqMetricsPanel, {
        metrics,
        trend: bucketByDay(rows, NOW),
        recent: recentActivity(rows),
        sampleSize: rows.length,
      }),
    )
    expect(html).toContain('In DLQ')
    expect(html).toContain('40.0%')
    expect(html).toContain('Based on the newest 2 DLQ entries.')
    expect(html).toContain('Transaction #100')
    expect(html).toContain('tx_bad_seq #0')
    expect(html).toContain(formatUtc(rows[0].createdAt))
  })
})

// ── List ──────────────────────────────────────────────────────────────────────

describe('DLQ list', () => {
  it('requests a page and clamps the size to what the backend accepts', async () => {
    const { api, calls } = fakeBackend([entry(1), entry(2), entry(3)])
    const page = await api.listDlq(2, 500)
    expect(calls[0].path).toBe('/dlq?page=2&limit=100')
    expect(page).toMatchObject({ page: 2, limit: 100, total: 3, data: [] })
    const first = await api.listDlq(0, 2)
    expect(calls[1].path).toBe('/dlq?page=1&limit=2')
    expect(first.data.map((r) => r.transactionId)).toEqual([101, 102])
  })

  it('renders per-entry status, attempts and the action each status allows', () => {
    const rows = [entry(1), entry(2, { status: 'pending', attemptCount: 0 }), entry(3, { status: 'cancelled' })]
    const html = renderToStaticMarkup(
      createElement(DlqTable, { entries: rows, onRetry: () => {}, onCancel: () => {} }),
    )
    expect(html).toContain('In DLQ')
    expect(html).toContain('Pending')
    expect(html).toContain('Cancelled')
    expect(html).toContain('5/5')
    expect(html).toContain('0/5')
    expect(html.match(/<button[^>]*>Retry<\/button>/g)).toHaveLength(1)
    expect(html.match(/<button[^>]*>Cancel retry<\/button>/g)).toHaveLength(1)
  })

  it('shows an empty state', () => {
    const html = renderToStaticMarkup(createElement(DlqTable, { entries: [], onRetry: () => {}, onCancel: () => {} }))
    expect(html).toContain('The dead-letter queue is empty.')
  })

  it('reads bigint timestamps sent as strings', () => {
    expect(toEpochMs('1760616000000')).toBe(1760616000000)
    expect(toEpochMs(null)).toBeNull()
    expect(toEpochMs('abc')).toBeNull()
    expect(formatUtc(String(NOW))).toBe('2026-10-16 12:00 UTC')
    expect(formatUtc(undefined)).toBe('—')
  })
})

// ── Single retry and cancel ───────────────────────────────────────────────────

describe('single retry', () => {
  it('re-queues one entry with a trimmed reason and returns it as pending', async () => {
    const { api, calls } = fakeBackend([entry(1), entry(2)])
    const updated = await api.retryEntry(entry(1).retryId, '  RPC outage resolved  ')
    expect(calls[0]).toEqual({
      method: 'POST',
      path: `/dlq/${entry(1).retryId}/retry`,
      body: { reason: 'RPC outage resolved' },
    })
    expect(updated.status).toBe('pending')
    expect((await api.getMetrics()).dlq).toBe(1)
  })

  it('sends no reason when none is given and encodes the id', async () => {
    const { api, calls } = fakeBackend([entry(1, { retryId: 'a/b' })])
    await api.retryEntry('a/b')
    expect(calls[0]).toMatchObject({ path: '/dlq/a%2Fb/retry', body: {} })
  })

  it('surfaces the backend message when the entry is no longer in the DLQ', async () => {
    const { api } = fakeBackend([entry(1)])
    await api.retryEntry(entry(1).retryId)
    const error = await api.retryEntry(entry(1).retryId).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(DlqApiError)
    expect((error as DlqApiError).status).toBe(500)
    expect((error as DlqApiError).message).toMatch(/not found or not in DLQ status/)
  })

  it('can cancel a re-queued retry, but not an entry still in the DLQ', async () => {
    const { api, calls, store } = fakeBackend([entry(1), entry(2)])
    await expect(api.cancelRetry(entry(2).retryId)).rejects.toThrow('Cannot cancel a DLQ entry')

    await api.retryEntry(entry(1).retryId)
    await expect(api.cancelRetry(entry(1).retryId)).resolves.toBeUndefined()
    expect(calls.at(-1)).toMatchObject({ method: 'DELETE', path: `/${entry(1).retryId}` })
    expect(store.find((r) => r.retryId === entry(1).retryId)?.status).toBe('cancelled')
  })
})

// ── Bulk retry and cleanup ────────────────────────────────────────────────────

describe('bulk retry', () => {
  it('sends the limit and re-queues only that many of the newest entries', async () => {
    const { api, calls, store } = fakeBackend([entry(1), entry(2), entry(3), entry(4)])
    const result = await api.bulkRetry(2)
    expect(calls[0]).toEqual({ method: 'POST', path: '/dlq/bulk-retry', body: { limit: 2 } })
    expect(result.results.map((r) => r.success)).toEqual([true, true])
    expect(store.filter((r) => r.status === 'pending').map((r) => r.transactionId)).toEqual([101, 102])
    expect((await api.getMetrics()).dlq).toBe(2)
  })

  it('requires typing a phrase that names the exact count', () => {
    const phrase = bulkRetryPhrase(25)
    expect(phrase).toBe('RETRY 25')
    expect(confirmationMatches('RETRY 25', phrase)).toBe(true)
    expect(confirmationMatches('  RETRY 25 ', phrase)).toBe(true)
    expect(confirmationMatches('retry 25', phrase)).toBe(false)
    expect(confirmationMatches('RETRY 2', phrase)).toBe(false)
    // Changing the count invalidates text typed for the old one.
    expect(confirmationMatches('RETRY 25', bulkRetryPhrase(30))).toBe(false)
  })

  it('renders the confirm button disabled until the phrase is typed', () => {
    const html = renderToStaticMarkup(
      createElement(ConfirmActionDialog, {
        open: true,
        title: 'Bulk retry DLQ entries?',
        description: 'desc',
        confirmLabel: 'Bulk retry',
        phrase: bulkRetryPhrase(3),
        danger: true,
        onConfirm: () => {},
        onClose: () => {},
      }),
    )
    expect(html).toContain('RETRY 3')
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Bulk retry<\/button>/)
  })

  it('renders nothing while closed', () => {
    const html = renderToStaticMarkup(
      createElement(ConfirmActionDialog, {
        open: false,
        title: 't',
        description: 'd',
        confirmLabel: 'c',
        onConfirm: () => {},
        onClose: () => {},
      }),
    )
    expect(html).toBe('')
  })
})

describe('cleanup', () => {
  it('calls the cleanup route and returns the server reply', async () => {
    const { api, calls } = fakeBackend([])
    const result = await api.cleanup(30)
    expect(calls[0]).toMatchObject({ method: 'DELETE', path: '/cleanup/30' })
    expect(result.message).toBe('Cleanup for retries older than 30 days')
    expect(cleanupPhrase(30)).toBe('CLEANUP 30')
  })

  it('refuses invalid day counts without calling the backend', async () => {
    const { api, fetchImpl } = fakeBackend([])
    for (const days of [0, -1, 1.5, Number.NaN]) {
      await expect(api.cleanup(days)).rejects.toBeInstanceOf(DlqApiError)
    }
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})

// ── Errors and envelopes ──────────────────────────────────────────────────────

describe('transaction lookup', () => {
  it('calls the transaction lookup endpoint and unwraps retry rows', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(Response.json({ ok: true, data: [entry(7)] }))
    const api = createDlqApi(fetchImpl as unknown as typeof fetch, BASE)

    await expect(api.getByTransactionId(42)).resolves.toEqual([entry(7)])
    expect(fetchImpl).toHaveBeenCalledWith(`${BASE}/transaction-retry/transaction/42`, expect.anything())
  })

  it('rejects invalid transaction IDs and maps not-found responses', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ message: 'Not found' }), { status: 404 }))
    const api = createDlqApi(fetchImpl as unknown as typeof fetch, BASE)

    await expect(api.getByTransactionId('abc')).rejects.toBeInstanceOf(DlqApiError)
    await expect(api.getByTransactionId(99)).rejects.toMatchObject({ status: 404 })
  })
})

describe('errors', () => {
  let fetchImpl: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchImpl = vi.fn()
  })

  it('joins validation messages and falls back to the status for non-JSON bodies', async () => {
    const api = createDlqApi(fetchImpl as unknown as typeof fetch, BASE)
    fetchImpl.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: ['limit must not be greater than 100', 'page must be an integer'] }), {
        status: 400,
      }),
    )
    await expect(api.listDlq(1, 20)).rejects.toThrow('limit must not be greater than 100, page must be an integer')

    fetchImpl.mockResolvedValueOnce(new Response('<html>bad gateway</html>', { status: 502 }))
    await expect(api.getMetrics()).rejects.toThrow('Request failed (502)')
  })

  it('peels nested envelopes only until the expected key appears', () => {
    expect(unwrapPayload({ ok: true, data: { data: { total: 1 } } }, 'total')).toEqual({ total: 1 })
    // A payload that itself has `data` (the DLQ page) is not unwrapped past its key.
    expect(unwrapPayload({ data: [], total: 0 }, 'total')).toEqual({ data: [], total: 0 })
  })
})

// ── Access and copy ───────────────────────────────────────────────────────────

describe('access', () => {
  it('limits the screen to the ADMIN role', () => {
    expect(DLQ_ROLES).toEqual(['ADMIN'])
    expect(canManageDlq('ADMIN')).toBe(true)
    for (const role of ['MODERATOR', 'USER', 'admin', '', undefined, null]) {
      expect(canManageDlq(role)).toBe(false)
    }
  })

  it('has a Spanish string for every English DLQ string', () => {
    const keys = (obj: unknown, prefix = ''): string[] =>
      obj && typeof obj === 'object'
        ? Object.entries(obj).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k))
        : [prefix]
    expect(keys(esJson.dlq).sort()).toEqual(keys(enJson.dlq).sort())
    expect(esJson.nav.transactionRetry).toBeTruthy()
  })
})
