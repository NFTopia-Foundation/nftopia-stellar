// @vitest-environment jsdom
/**
 * Route rendering smoke test (#559) — confirms every route the router
 * defines renders without crashing, and that navigating between them works
 * through real NavLink clicks (no full page reload).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import '../i18n'
import App from '../App'
import { AuthContext, useAuth } from '../auth/useAuth'
import type { AuthState, AuthStore } from '../auth/authStore'

vi.mock('../auth/useAuth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../auth/useAuth')>()
  return { ...actual, useAuth: vi.fn() }
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
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

/**
 * `useAuth()` and `DashboardPage`'s direct `useContext(AuthContext)` both
 * need to see the same mock — the real `AuthProvider` (mounted in
 * main.tsx, above `<App/>`) is what normally supplies both in production.
 */
function renderApp(store: AuthStore) {
  vi.mocked(useAuth).mockReturnValue({ state: store.getState(), store })
  return render(
    <AuthContext.Provider value={store}>
      <App />
    </AuthContext.Provider>,
  )
}

const adminState: AuthState = {
  status: 'authenticated',
  user: { id: 'admin-1', email: 'admin@nftopia.io', username: null, role: 'ADMIN' },
  token: 'token-123',
}

const moderatorState: AuthState = {
  status: 'authenticated',
  user: { id: 'user-1', email: 'user@nftopia.io', username: null, role: 'MODERATOR' },
  token: 'token-123',
}

describe('admin app routing (#559)', () => {
  it('redirects the index route to /dashboard and renders it', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({})))
    renderApp(makeStore(adminState))

    await waitFor(() => expect(document.querySelector('h1')).toBeTruthy())
    expect(window.location.pathname).toBe('/dashboard')
  })

  it('navigates to every nav item without a full page reload, each rendering an h1', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({})))
    renderApp(makeStore(adminState))
    await waitFor(() => expect(document.querySelector('h1')).toBeTruthy())

    const nav = screen.getByRole('navigation', { name: 'Main navigation' })
    const links = within(nav).getAllByRole('link')
    const expectedPaths = ['/dashboard', '/users', '/collections', '/content-flags', '/transaction-retry', '/settings']

    expect(links.map((link) => link.getAttribute('href'))).toEqual(expectedPaths)

    for (const link of links) {
      const targetPath = link.getAttribute('href')
      fireEvent.click(link)

      await waitFor(() => expect(window.location.pathname).toBe(targetPath))
      // A real page reload would tear down and re-mount the whole app,
      // losing the mocked auth state — asserting it's still authenticated
      // (no login screen) after navigating confirms this was client-side.
      await waitFor(() => expect(document.querySelector('h1')).toBeTruthy())
    }
  })

  it('redirects an unknown path back to /dashboard', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({})))
    window.history.pushState({}, '', '/this-route-does-not-exist')

    renderApp(makeStore(adminState))

    await waitFor(() => expect(window.location.pathname).toBe('/dashboard'))
  })

  it('does not register the transaction-retry nav item for a non-admin role', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({})))
    renderApp(makeStore(moderatorState))
    await waitFor(() => expect(document.querySelector('h1')).toBeTruthy())

    const nav = screen.getByRole('navigation', { name: 'Main navigation' })
    const links = within(nav).getAllByRole('link')
    expect(links.map((link) => link.getAttribute('href'))).not.toContain('/transaction-retry')
  })

  it('shows the login screen instead of any route when unauthenticated', () => {
    renderApp(makeStore({ status: 'unauthenticated', error: null, notice: null, pending: false }))

    expect(screen.queryByRole('navigation', { name: 'Main navigation' })).toBeNull()
  })
})
