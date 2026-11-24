import { toEpochMs, type DlqEntry, type RetryMetrics } from './dlqApi'

/**
 * Pure helpers that turn the metrics counts and DLQ rows into what the
 * dashboard shows. `GET metrics` only returns current counts per status, so the
 * trend is derived from the `createdAt` of the newest DLQ entries.
 */

const DAY_MS = 24 * 60 * 60 * 1000

export interface MetricsSummary {
  dlq: number
  /** Retries still in flight: pending + processing. */
  inFlight: number
  /** Share of finished retries that ended in failure or the DLQ, 0–1; null with nothing finished. */
  failureRate: number | null
  total: number
}

export function summarizeMetrics(metrics: RetryMetrics): MetricsSummary {
  const failures = metrics.failed + metrics.dlq
  const finished = failures + metrics.completed
  return {
    dlq: metrics.dlq,
    inFlight: metrics.pending + metrics.processing,
    failureRate: finished > 0 ? failures / finished : null,
    total: metrics.total,
  }
}

export interface DayBucket {
  /** Start of the UTC day, epoch ms. */
  day: number
  count: number
}

export type FailureReasonCategory = 'timeout' | 'insufficient_balance' | 'contract_error' | 'rpc_unavailable' | 'other'

export interface FailureReasonGroup {
  reason: FailureReasonCategory
  count: number
  share: number
}

/** Normalizes variable DLQ error text into one of the operator-facing failure categories. */
export function normalizeFailureReason(lastError: string | null | undefined): FailureReasonCategory {
  const text = (lastError ?? '')
    .toLowerCase()
    .replace(/\b[gm][a-z2-7]{20,}\b/gi, 'address')
    .replace(/\b(?:0x)?[a-f0-9]{16,}\b/gi, 'id')
    .replace(/\d+(?:\.\d+)?/g, 'n')
  if (/timeout|timed out|deadline exceeded|etimedout/.test(text)) return 'timeout'
  if (/insufficient (?:balance|funds)|not enough (?:balance|funds)|underfunded/.test(text)) return 'insufficient_balance'
  if (/contract.*(?:error|code)|(?:error|code).*contract|op_[a-z_]+|host function error/.test(text)) return 'contract_error'
  if (/rpc unavailable|rpc.*(?:down|unavailable|offline)|econnrefused|bad gateway|service unavailable|network unreachable/.test(text)) return 'rpc_unavailable'
  return 'other'
}

/** Groups a DLQ sample by normalized reason, largest group first. */
export function groupFailureReasons(entries: DlqEntry[]): FailureReasonGroup[] {
  const counts = new Map<FailureReasonCategory, number>()
  for (const entry of entries) {
    const reason = normalizeFailureReason(entry.lastError)
    counts.set(reason, (counts.get(reason) ?? 0) + 1)
  }
  const total = entries.length
  return [...counts.entries()].map(([reason, count]) => ({ reason, count, share: total ? count / total : 0 }))
    .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason))
}

/**
 * Counts entries per UTC day over the last `days` days, oldest first, with
 * empty days included so the chart has no gaps.
 */
export function bucketByDay(entries: DlqEntry[], now: number, days = 7): DayBucket[] {
  const today = Math.floor(now / DAY_MS) * DAY_MS
  const first = today - (days - 1) * DAY_MS
  const buckets: DayBucket[] = Array.from({ length: days }, (_, i) => ({ day: first + i * DAY_MS, count: 0 }))
  for (const entry of entries) {
    const at = toEpochMs(entry.createdAt)
    if (at === null || at < first || at >= today + DAY_MS) continue
    buckets[Math.floor((at - first) / DAY_MS)].count += 1
  }
  return buckets
}

/** The `limit` most recent entries by `createdAt`, newest first. */
export function recentActivity(entries: DlqEntry[], limit = 5): DlqEntry[] {
  return [...entries]
    .sort((a, b) => (toEpochMs(b.createdAt) ?? 0) - (toEpochMs(a.createdAt) ?? 0))
    .slice(0, limit)
}

/** Text an operator must type to confirm a bulk retry of `count` entries. */
export function bulkRetryPhrase(count: number): string {
  return `RETRY ${count}`
}

/** Text an operator must type to confirm a cleanup of entries older than `days`. */
export function cleanupPhrase(days: number): string {
  return `CLEANUP ${days}`
}

/** Typed confirmations compare trimmed and case-sensitively, so a stray paste can't match. */
export function confirmationMatches(typed: string, phrase: string): boolean {
  return typed.trim() === phrase
}
