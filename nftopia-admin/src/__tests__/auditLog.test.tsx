// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import '../i18n'
import AuditLogPage from '../pages/AuditLogPage'
import { AuthContext, useAuth } from '../auth/useAuth'
import type { AuthState, AuthStore } from '../auth/authStore'

vi.mock('../auth/useAuth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../auth/useAuth')>()
  return { ...actual, useAuth: vi.fn() }
})

const state: AuthState = { status: 'authenticated', user: { id: 'admin-1', email: 'admin@nftopia.io', username: 'admin', role: 'ADMIN' }, token: 'token' }
const store: AuthStore = { getState: () => state, subscribe: () => () => {}, restore: vi.fn(), login: vi.fn(), verifyTwoFactor: vi.fn(), logout: vi.fn(), handleUnauthorized: vi.fn() }

afterEach(() => vi.unstubAllGlobals())

describe('platform audit log page', () => {
  it('loads the endpoint and renders actor, action, target, IP and user agent', async () => {
    vi.mocked(useAuth).mockReturnValue({ state, store })
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ data: { logs: [{ id: 'log-1', adminId: '11111111-1111-1111-1111-111111111111', action: 'BAN_USER', entityType: 'user', entityId: '22222222-2222-2222-2222-222222222222', createdAt: '2026-01-01T00:00:00Z', ipAddress: '127.0.0.1', userAgent: 'Test Agent' }], total: 1 } })))

    render(<MemoryRouter><AuthContext.Provider value={store}><AuditLogPage /></AuthContext.Provider></MemoryRouter>)

    await waitFor(() => expect(screen.getByText('BAN_USER')).toBeTruthy())
    expect(screen.getByText('127.0.0.1')).toBeTruthy()
    expect(screen.getByText('Test Agent')).toBeTruthy()
    expect(screen.getByRole('link', { name: '22222222-2222-2222-2222-222222222222' }).getAttribute('href')).toContain('/users')
  })
})
