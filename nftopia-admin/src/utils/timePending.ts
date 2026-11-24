const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

/** Queue items pending longer than this are flagged as overdue (#562). */
export const VERIFICATION_SLA_MS = 48 * HOUR_MS

export interface TimePending {
  /** e.g. "3h ago", "2d ago". */
  label: string
  /** True once the item has been pending longer than the SLA. */
  overdue: boolean
}

/**
 * How long a queue item has been pending, for display next to each row.
 * `createdAt` is whatever the API returned for the item's creation time;
 * an unparseable value falls back to an empty, non-overdue label rather
 * than throwing, since this is a secondary UI affordance, not a gate.
 */
export function formatTimePending(createdAt: string, now: Date = new Date()): TimePending {
  const created = new Date(createdAt).getTime()
  if (Number.isNaN(created)) {
    return { label: '—', overdue: false }
  }

  const elapsedMs = Math.max(0, now.getTime() - created)
  const overdue = elapsedMs > VERIFICATION_SLA_MS

  if (elapsedMs < HOUR_MS) {
    const minutes = Math.max(1, Math.floor(elapsedMs / MINUTE_MS))
    return { label: `${minutes}m ago`, overdue }
  }
  if (elapsedMs < DAY_MS) {
    const hours = Math.floor(elapsedMs / HOUR_MS)
    return { label: `${hours}h ago`, overdue }
  }
  const days = Math.floor(elapsedMs / DAY_MS)
  return { label: `${days}d ago`, overdue }
}
