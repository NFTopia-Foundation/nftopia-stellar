import { API_BASE_URL } from '../auth/authApi'

/**
 * Client for the transaction retry / dead-letter-queue admin API exposed by
 * `nftopia-backend/src/modules/transaction/transaction-retry.controller.ts`.
 * Every route there requires the ADMIN role.
 */

export type RetryStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'dlq'

/** `GET /transaction-retry/metrics`: retry rows counted by status. */
export interface RetryMetrics {
  pending: number
  processing: number
  completed: number
  failed: number
  cancelled: number
  dlq: number
  total: number
}

/**
 * A `transaction_retries` row. The `bigint` timestamp columns (epoch ms) come
 * back from Postgres as strings, so they are typed loosely here and read with
 * `toEpochMs`.
 */
export interface DlqEntry {
  id: string
  retryId: string
  transactionId: number
  contractTxId: string
  status: RetryStatus
  attemptCount: number
  maxAttempts: number
  lastError?: string | null
  errorHistory?: Array<{ attempt: number; error: string; timestamp: number | string }> | null
  createdAt: number | string
  nextRetryAt?: number | string | null
  completedAt?: number | string | null
  updatedDate?: string
}

export interface DlqPage {
  data: DlqEntry[]
  page: number
  limit: number
  total: number
}

export interface BulkRetryResult {
  message: string
  results: Array<{ retryId: string; success: boolean; error?: string }>
}

export interface CleanupResult {
  message: string
}

export interface DlqApi {
  getMetrics(): Promise<RetryMetrics>
  listDlq(page: number, limit: number): Promise<DlqPage>
  retryEntry(retryId: string, reason?: string): Promise<DlqEntry>
  bulkRetry(limit: number): Promise<BulkRetryResult>
  cancelRetry(retryId: string): Promise<void>
  cleanup(days: number): Promise<CleanupResult>
}

/** Page size the backend accepts for `GET dlq` (`RetryQueryDto` caps it at 100). */
export const MAX_PAGE_SIZE = 100

export class DlqApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'DlqApiError'
    this.status = status
  }
}

/** Reads a backend epoch-ms value that may arrive as a number or a numeric string. */
export function toEpochMs(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * Global interceptors may wrap a payload as `{ ok, data, stellarMeta }`.
 * Peel those envelopes off until the object carrying `key` is reached.
 */
export function unwrapPayload<T>(body: unknown, key: string): T {
  let current = body as Record<string, unknown> | undefined
  while (
    current &&
    typeof current === 'object' &&
    !(key in current) &&
    'data' in current &&
    current.data &&
    typeof current.data === 'object'
  ) {
    current = current.data as Record<string, unknown>
  }
  return current as T
}

async function errorFrom(response: Response): Promise<DlqApiError> {
  let message = `Request failed (${response.status})`
  try {
    const body = (await response.json()) as { message?: unknown; error?: unknown }
    if (typeof body.message === 'string' && body.message) message = body.message
    else if (Array.isArray(body.message) && body.message.length > 0) message = body.message.join(', ')
    else if (typeof body.error === 'string' && body.error) message = body.error
  } catch {
    // Non-JSON error body: keep the status-only message.
  }
  return new DlqApiError(response.status, message)
}

export function createDlqApi(fetchImpl: typeof fetch, baseUrl: string = API_BASE_URL): DlqApi {
  const root = `${baseUrl}/transaction-retry`

  async function request<T>(path: string, init: RequestInit = {}): Promise<T | undefined> {
    const response = await fetchImpl(`${root}${path}`, init)
    if (!response.ok) throw await errorFrom(response)
    if (response.status === 204) return undefined
    const text = await response.text()
    return text ? (JSON.parse(text) as T) : undefined
  }

  function postJson(body: unknown): RequestInit {
    return {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  }

  return {
    async getMetrics() {
      return unwrapPayload<RetryMetrics>(await request('/metrics'), 'dlq')
    },

    async listDlq(page, limit) {
      const size = Math.min(Math.max(1, Math.floor(limit)), MAX_PAGE_SIZE)
      const query = new URLSearchParams({ page: String(Math.max(1, Math.floor(page))), limit: String(size) })
      const body = unwrapPayload<DlqPage>(await request(`/dlq?${query}`), 'total')
      return { data: body?.data ?? [], page: body?.page ?? page, limit: body?.limit ?? size, total: body?.total ?? 0 }
    },

    async retryEntry(retryId, reason) {
      const trimmed = reason?.trim()
      const body = await request<unknown>(
        `/dlq/${encodeURIComponent(retryId)}/retry`,
        postJson(trimmed ? { reason: trimmed } : {}),
      )
      return unwrapPayload<{ data: DlqEntry }>(body, 'message').data
    },

    async bulkRetry(limit) {
      return unwrapPayload<BulkRetryResult>(await request('/dlq/bulk-retry', postJson({ limit })), 'results')
    },

    async cancelRetry(retryId) {
      await request(`/${encodeURIComponent(retryId)}`, { method: 'DELETE' })
    },

    async cleanup(days) {
      if (!Number.isInteger(days) || days < 1) {
        throw new DlqApiError(400, 'Days must be a positive whole number')
      }
      return unwrapPayload<CleanupResult>(await request(`/cleanup/${days}`, { method: 'DELETE' }), 'message')
    },
  }
}
