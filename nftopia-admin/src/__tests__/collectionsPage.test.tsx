// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import CollectionsPage from '../pages/CollectionsPage'
import { useAuth } from '../auth/useAuth'

vi.mock('../auth/useAuth', () => ({
  useAuth: vi.fn(),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number; collectionName?: string }) => {
      const messages: Record<string, string> = {
        'nav.collections': 'Collections',
        'collections.description': 'Review and verify NFT collections awaiting publication.',
        'collections.empty': 'No collections match these filters.',
        'collections.error.load': 'Unable to load collections.',
        'collections.error.approve': 'Unable to approve the collection. Please try again.',
        'collections.error.reject': 'Unable to reject the collection. Please try again.',
        'collections.error.bulkAction': 'Unable to resolve some of the selected collections. Please try again.',
        'collections.error.resolve': 'Unable to resolve the collection. Please try again.',
        'collections.success.approve': 'Collection successfully approved.',
        'collections.success.reject': 'Collection successfully rejected.',
        'collections.filters.status': 'Status',
        'collections.confirm.approve': `Approve collection ${options?.collectionName} for publication?`,
        'collections.confirm.reject': `Reject collection ${options?.collectionName}?`,
        'collections.columns.select': 'Select',
        'collections.columns.selectAll': 'Select all',
        'collections.columns.item': 'Item',
        'collections.columns.reason': 'Reason',
        'collections.columns.severity': 'Severity',
        'collections.columns.status': 'Status',
        'collections.columns.created': 'Created',
        'collections.columns.actions': 'Actions',
        'collections.actions.bulkApproveReject': 'Approve/reject selected',
        'collections.actions.view': 'View',
        'collections.status.pending': 'Pending',
        'collections.status.approved': 'Approved',
        'collections.status.rejected': 'Rejected',
        'collections.pending.overdue': 'overdue',
        'collections.pagination.label': 'Collection verification pages',
        'collections.pagination.previous': 'Previous',
        'collections.pagination.next': 'Next',
      }
      if (key === 'collections.results') return `${options?.count} matching collections (showing up to 50).`
      return messages[key] ?? key
    },
  }),
}))

const verifications = [
  {
    id: 'ver-1',
    collectionId: 'col-1',
    entityType: 'collection',
    reason: 'New collection submission',
    severity: 'low',
    confidence: 0.5,
    status: 'pending',
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2h ago
    name: 'Cosmic Cats',
    description: 'A collection of cosmic cats',
    imageUrl: 'https://example.com/cosmic-cats.png',
  },
  {
    id: 'ver-2',
    collectionId: 'col-2',
    entityType: 'collection',
    reason: 'New collection submission',
    severity: 'medium',
    confidence: 0.6,
    status: 'pending',
    createdAt: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(), // 72h ago, overdue
    name: 'Overdue Owls',
    description: 'A collection of owls',
    imageUrl: 'https://example.com/owls.png',
  },
]

function setupFetch() {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (init?.method === 'POST' && /\/admin\/verifications\//.test(url)) {
      return new Response('{}', { status: 200 })
    }
    if (/\/collections\/[^/?]+(?:\?|$)/.test(url)) {
      return Response.json({})
    }
    return Response.json({ verifications, total: verifications.length })
  })
  const store = {
    getState: () => ({ status: 'authenticated', token: 'admin-token' }),
    handleUnauthorized: vi.fn(),
  }
  vi.mocked(useAuth).mockReturnValue({ store } as never)
  vi.stubGlobal('fetch', fetchMock)
  vi.stubGlobal('confirm', vi.fn(() => true))
  return fetchMock
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('Collection verifications queue (#562)', () => {
  it('lists pending verifications with a time-pending indicator', async () => {
    setupFetch()
    render(<CollectionsPage />)

    expect(await screen.findByText('Cosmic Cats')).toBeTruthy()
    expect(screen.getByText('Overdue Owls')).toBeTruthy()
    expect(screen.getByText('2h ago')).toBeTruthy()
    expect(screen.getByText(/3d ago \(overdue\)/)).toBeTruthy()
  })

  it('approves a collection through the review-then-confirm dialog', async () => {
    const fetchMock = setupFetch()
    render(<CollectionsPage />)
    await screen.findByText('Cosmic Cats')

    fireEvent.click(screen.getAllByRole('button', { name: 'View' })[0])
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/admin/verifications/ver-1/approve'),
        expect.objectContaining({ method: 'POST' }),
      ),
    )
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toBe('Collection successfully approved.'),
    )
  })

  it('rejects a collection with a required reason', async () => {
    const fetchMock = setupFetch()
    render(<CollectionsPage />)
    await screen.findByText('Cosmic Cats')

    fireEvent.click(screen.getAllByRole('button', { name: 'View' })[0])
    fireEvent.click(screen.getByRole('radio', { name: /Reject/ }))

    // The review step is disabled without a reason.
    expect((screen.getByRole('button', { name: 'Reject' }) as HTMLButtonElement).disabled).toBe(true)

    fireEvent.change(screen.getByLabelText(/Reason/), {
      target: { value: 'Artwork does not meet guidelines' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Reject' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/admin/verifications/ver-1/reject'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ reason: 'Artwork does not meet guidelines' }),
        }),
      ),
    )
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toBe('Collection successfully rejected.'),
    )
  })
})
