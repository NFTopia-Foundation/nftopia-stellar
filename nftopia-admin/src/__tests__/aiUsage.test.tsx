// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import '../i18n'
import AiUsagePage from '../pages/AiUsagePage'
import { AuthContext, useAuth } from '../auth/useAuth'
import type { AuthState, AuthStore } from '../auth/authStore'

vi.mock('../auth/useAuth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../auth/useAuth')>()
  return { ...actual, useAuth: vi.fn() }
})

const state: AuthState = { status: 'authenticated', user: { id: 'admin-1', email: 'admin@nftopia.io', username: 'admin', role: 'ADMIN' }, token: 'token' }
const store: AuthStore = {
  getState: () => state,
  subscribe: () => () => {},
  restore: vi.fn(),
  login: vi.fn(),
  verifyTwoFactor: vi.fn(),
  logout: vi.fn(),
  handleUnauthorized: vi.fn(),
}

afterEach(() => vi.unstubAllGlobals())

describe('AI usage dashboard', () => {
  it('renders health, per-user usage and tool logs', async () => {
    vi.mocked(useAuth).mockReturnValue({ state, store })
    vi.stubGlobal('fetch', vi.fn(async (input: string) => {
      if (input.endsWith('/ai/health')) return Response.json({ status: 'up', timestamp: '2026-01-01T00:00:00Z' })
      if (input.includes('/ai/admin/tool-logs')) return Response.json({ data: [{ id: 'log-1', userId: 'user-1', sessionId: 'session-1', toolName: 'search_listings', success: true, createdAt: '2026-01-01T00:00:00Z' }], total: 1 })
      if (input.includes('/ai/admin/usage/user-1')) return Response.json({ data: { daily: { totalTokens: 120, estimatedCostUsd: 0.1, cap: 1000, remaining: 880, spendCapUsd: null, percentUsed: 12, resetsAt: '2026-01-02T00:00:00Z' }, monthly: { totalTokens: 900, estimatedCostUsd: 0.8, cap: 10000, remaining: 9100, spendCapUsd: null, percentUsed: 9, resetsAt: '2026-02-01T00:00:00Z' }, hasOverride: false } })
      return new Response(null, { status: 404 })
    }))

    render(<AuthContext.Provider value={store}><AiUsagePage /></AuthContext.Provider>)

    await waitFor(() => expect(screen.getByText('AI healthy')).toBeTruthy())
    fireEvent.change(screen.getByLabelText('User ID'), { target: { value: 'user-1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Look up' }))
    await waitFor(() => expect(screen.getByText('120')).toBeTruthy())
    expect(screen.getByText('search_listings')).toBeTruthy()
  })
})
