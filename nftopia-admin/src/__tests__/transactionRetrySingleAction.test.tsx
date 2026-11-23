// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import TransactionRetryPage from '../pages/TransactionRetryPage'
import { useAuth } from '../auth/useAuth'
import '../i18n'

vi.mock('../auth/useAuth', () => ({
  useAuth: vi.fn(),
}))

const mockDlqEntry = {
  id: 'row-1',
  retryId: 'test-retry-uuid-1',
  transactionId: 101,
  contractTxId: 'contract-tx-abc',
  status: 'dlq' as const,
  attemptCount: 5,
  maxAttempts: 5,
  lastError: 'Transaction sequence error: tx_bad_seq',
  createdAt: '1760616000000',
}

const mockMetrics = {
  pending: 0,
  processing: 0,
  completed: 2,
  failed: 0,
  cancelled: 0,
  dlq: 1,
  total: 3,
}

describe('Single-entry DLQ retry action (Issue #693)', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    const store = {
      getState: () => ({ status: 'authenticated', token: 'admin-token' }),
      handleUnauthorized: vi.fn(),
    }
    vi.mocked(useAuth).mockReturnValue({
      state: { status: 'authenticated', user: { role: 'ADMIN', email: 'admin@nftopia.com' } },
      store,
    } as never)
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  function setupFetch({ retryFails = false, errorMessage = 'DLQ entry not found or not in DLQ status' } = {}) {
    fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'

      if (url.includes('/metrics') && method === 'GET') {
        return Response.json(mockMetrics)
      }

      if (url.includes('/dlq?') && method === 'GET') {
        return Response.json({
          data: [mockDlqEntry],
          page: 1,
          limit: 20,
          total: 1,
        })
      }

      if (url.includes(`/dlq/${mockDlqEntry.retryId}/retry`) && method === 'POST') {
        if (retryFails) {
          return new Response(JSON.stringify({ statusCode: 500, message: errorMessage }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        const body = init?.body ? JSON.parse(String(init.body)) : {}
        return Response.json({
          message: 'DLQ entry re-enqueued for retry',
          reason: body.reason,
          data: {
            ...mockDlqEntry,
            status: 'pending',
            attemptCount: 0,
            lastError: null,
          },
        })
      }

      return new Response('Not Found', { status: 404 })
    })

    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
  }

  it('renders the single DLQ entry with a Retry button and current attempts count', async () => {
    setupFetch()
    render(<TransactionRetryPage />)

    expect(await screen.findByText('#101')).toBeTruthy()
    expect(screen.getAllByText('In DLQ').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('5/5')).toBeTruthy()
    expect(screen.getByText('Transaction sequence error: tx_bad_seq')).toBeTruthy()

    const retryButton = screen.getByRole('button', { name: 'Retry' }) as HTMLButtonElement
    expect(retryButton).toBeTruthy()
    expect(retryButton.disabled).toBe(false)
  })

  it('requires confirmation before submitting and allows cancelling the prompt', async () => {
    const fetch = setupFetch()
    render(<TransactionRetryPage />)

    const retryButton = await screen.findByRole('button', { name: 'Retry' })
    fireEvent.click(retryButton)

    // Modal dialog is opened
    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeTruthy()
    expect(screen.getByText('Retry this transaction?')).toBeTruthy()
    expect(screen.getByLabelText(/Reason/i)).toBeTruthy()

    // No POST request was sent yet
    const postCallsBefore = fetch.mock.calls.filter(([, init]) => init?.method === 'POST')
    expect(postCallsBefore).toHaveLength(0)

    // Clicking Cancel closes the modal
    const cancelButton = screen.getByRole('button', { name: 'Cancel' })
    fireEvent.click(cancelButton)

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
    })

    const postCallsAfter = fetch.mock.calls.filter(([, init]) => init?.method === 'POST')
    expect(postCallsAfter).toHaveLength(0)
  })

  it('successfully retries a single entry with reason, updates status to pending and resets attempt count', async () => {
    const fetch = setupFetch()
    render(<TransactionRetryPage />)

    const retryButton = await screen.findByRole('button', { name: 'Retry' })
    fireEvent.click(retryButton)

    const reasonInput = screen.getByLabelText(/Reason/i)
    fireEvent.change(reasonInput, { target: { value: 'Ledger sequence verified and safe to re-attempt' } })

    const confirmButton = screen.getAllByRole('button', { name: 'Retry' }).find(
      (btn) => btn.closest('[role="dialog"]') !== null,
    )
    expect(confirmButton).toBeTruthy()
    fireEvent.click(confirmButton!)

    // Verify API POST request was made with correct path and body
    await waitFor(() => {
      const postCalls = fetch.mock.calls.filter(([, init]) => init?.method === 'POST')
      expect(postCalls).toHaveLength(1)
      expect(String(postCalls[0][0])).toContain(`/dlq/${mockDlqEntry.retryId}/retry`)
      expect(JSON.parse(String(postCalls[0][1]?.body))).toEqual({
        reason: 'Ledger sequence verified and safe to re-attempt',
      })
    })

    // Confirmation dialog closes
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
    })

    // Immediate UI update:
    // Status updates to Pending
    expect(await screen.findByText('Pending')).toBeTruthy()
    // Retry count updates immediately to 0/5
    expect(screen.getByText('0/5')).toBeTruthy()
    // Stale error text is cleared
    expect(screen.queryByText('Transaction sequence error: tx_bad_seq')).toBeNull()
    // Success notification banner appears
    const statusNotice = screen.getByRole('status')
    expect(statusNotice.textContent).toContain('Transaction #101 was re-queued for retry.')
    // Action button changes from Retry to Cancel retry
    expect(screen.getByRole('button', { name: 'Cancel retry' })).toBeTruthy()
  })

  it('clearly communicates failure if the retry request fails', async () => {
    setupFetch({ retryFails: true, errorMessage: 'Network timeout contacting Horizon node' })
    render(<TransactionRetryPage />)

    const retryButton = await screen.findByRole('button', { name: 'Retry' })
    fireEvent.click(retryButton)

    const confirmButton = screen.getAllByRole('button', { name: 'Retry' }).find(
      (btn) => btn.closest('[role="dialog"]') !== null,
    )
    fireEvent.click(confirmButton!)

    // Dialog remains open and displays the error message with role="alert"
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Network timeout contacting Horizon node')

    // Entry status remains unchanged in DLQ
    expect(screen.getAllByText('In DLQ').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('5/5')).toBeTruthy()
  })
})
