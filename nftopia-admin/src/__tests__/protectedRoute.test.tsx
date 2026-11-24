// @vitest-environment jsdom
/**
 * Unit test for the reusable per-route auth gate (#698), isolated from the
 * full App router. See routes.test.tsx for the integration-level coverage
 * of this same redirect through the real app routes.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from '../components/ProtectedRoute'
import { AuthContext } from '../auth/useAuth'
import type { AuthState, AuthStore } from '../auth/authStore'

afterEach(() => {
  cleanup()
})

function makeStore(state: AuthState): AuthStore {
  return {
    getState: () => state,
    subscribe: () => () => {},
    restore: vi.fn(),
    login: vi.fn(),
    verifyTwoFactor: vi.fn(),
    logout: vi.fn(),
    handleUnauthorized: vi.fn(),
  }
}

function renderProtected(state: AuthState, initialPath = '/secret') {
  return render(
    <AuthContext.Provider value={makeStore(state)}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/login" element={<div>Login screen</div>} />
          <Route
            path="/secret"
            element={
              <ProtectedRoute>
                <div>Secret content</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

describe('ProtectedRoute (#698)', () => {
  it('redirects an unauthenticated visit to /login instead of rendering children', () => {
    renderProtected({ status: 'unauthenticated', error: null, notice: null, pending: false })

    expect(screen.getByText('Login screen')).toBeTruthy()
    expect(screen.queryByText('Secret content')).toBeNull()
  })

  it('renders the protected children once authenticated', () => {
    renderProtected({
      status: 'authenticated',
      user: { id: 'u1', email: 'admin@nftopia.io', username: null, role: 'ADMIN' },
      token: 'token-123',
    })

    expect(screen.getByText('Secret content')).toBeTruthy()
    expect(screen.queryByText('Login screen')).toBeNull()
  })
})
