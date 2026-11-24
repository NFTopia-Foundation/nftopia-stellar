// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import '../i18n'
import { DlqMetricsPanel } from '../components/DlqMetricsPanel'
import { groupFailureReasons, normalizeFailureReason } from '../dlq/dlqStats'
import type { DlqEntry } from '../dlq/dlqApi'

function entry(retryId: string, lastError: string): DlqEntry {
  return {
    id: retryId,
    retryId,
    transactionId: 1,
    contractTxId: 'ctx-1',
    status: 'dlq',
    attemptCount: 3,
    maxAttempts: 3,
    lastError,
    createdAt: 1,
  }
}

describe('DLQ failure reasons', () => {
  it('normalizes timeout, balance, contract, RPC and unknown errors', () => {
    expect(normalizeFailureReason('request 123 timed out after 30s')).toBe('timeout')
    expect(normalizeFailureReason('insufficient balance for account GABC123')).toBe('insufficient_balance')
    expect(normalizeFailureReason('contract error code 12')).toBe('contract_error')
    expect(normalizeFailureReason('RPC unavailable: ECONNREFUSED')).toBe('rpc_unavailable')
    expect(normalizeFailureReason('unexpected worker crash')).toBe('other')
  })

  it('groups normalized reasons with counts and shares', () => {
    const rows = [
      entry('1', 'request timed out'),
      entry('2', 'deadline exceeded for tx 44'),
      entry('3', 'insufficient balance'),
    ]
    expect(groupFailureReasons(rows)).toEqual([
      { reason: 'timeout', count: 2, share: 2 / 3 },
      { reason: 'insufficient_balance', count: 1, share: 1 / 3 },
    ])
  })

  it('renders a clickable top-reasons panel', () => {
    const onReasonSelect = vi.fn()
    render(
      <DlqMetricsPanel
        metrics={{ pending: 0, processing: 0, completed: 0, failed: 0, cancelled: 0, dlq: 2, total: 2 }}
        trend={[]}
        recent={[entry('1', 'request timed out'), entry('2', 'RPC unavailable')]}
        reasonEntries={[entry('1', 'request timed out'), entry('2', 'RPC unavailable')]}
        sampleSize={2}
        onReasonSelect={onReasonSelect}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Timeout/i }))
    expect(onReasonSelect).toHaveBeenCalledWith('timeout')
  })
})
