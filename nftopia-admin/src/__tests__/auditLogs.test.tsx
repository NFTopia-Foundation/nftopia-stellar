// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import '../i18n'
import AuditLogsPage from '../pages/AuditLogsPage'
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

describe('audit log filters', () => {
  it('maps actor, action, entity and date filters into the request and URL', async () => {
    vi.mocked(useAuth).mockReturnValue({ state, store })
    const requests: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (input: string) => {
      requests.push(input)
      return Response.json({ data: { logs: [], total: 0 } })
    }))

    render(
      <MemoryRouter initialEntries={['/audit-logs']}>
        <AuthContext.Provider value={store}><AuditLogsPage /></AuthContext.Provider>
      </MemoryRouter>,
    )

    fireEvent.change(screen.getByLabelText('Admin user'), { target: { value: '11111111-1111-1111-1111-111111111111' } })
    fireEvent.change(screen.getByLabelText('Action type'), { target: { value: 'BAN_USER' } })
    fireEvent.change(screen.getByLabelText('Entity type'), { target: { value: 'user' } })
    fireEvent.change(screen.getByLabelText('Entity ID'), { target: { value: '22222222-2222-2222-2222-222222222222' } })
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-01-01' } })
    fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2026-01-31' } })

    await waitFor(() => {
      const mapped = [...requests].reverse().find((url) => url.includes('adminId=') && url.includes('action=BAN_USER'))
      expect(mapped).toContain('entityType=user')
      expect(mapped).toContain('startDate=2026-01-01T00%3A00%3A00.000Z')
      expect(mapped).toContain('endDate=2026-01-31T23%3A59%3A59.999Z')
    })
  })
})
