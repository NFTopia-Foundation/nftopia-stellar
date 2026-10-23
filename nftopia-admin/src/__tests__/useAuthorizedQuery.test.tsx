// @vitest-environment jsdom
/**
 * TanStack Query data-fetching layer (#561) — built on top of the shared
 * authorized fetch client, for use by future admin screens.
 */
import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthContext } from '../auth/useAuth'
import type { AuthState, AuthStore } from '../auth/authStore'
import { useAuthorizedQuery, ApiRequestError } from '../lib/api/useAuthorizedQuery'

function makeStore(initialState: AuthState): AuthStore & { state: AuthState } {
  const listeners = new Set<() => void>()
  const store = {
    state: initialState,
    getState() {
      return store.state
    },
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    restore: vi.fn(),
    login: vi.fn(),
    verifyTwoFactor: vi.fn(),
    logout: vi.fn(),
    handleUnauthorized: vi.fn(() => {
      store.state = { status: 'unauthenticated', error: null, notice: 'session_expired', pending: false }
      listeners.forEach((l) => l())
    }),
  }
  return store
}

function wrapperFor(store: AuthStore) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider value={store}>{children}</AuthContext.Provider>
      </QueryClientProvider>
    )
  }
}

const authenticatedState: AuthState = {
  status: 'authenticated',
  user: { id: 'admin-1', email: 'admin@nftopia.io', username: null, role: 'ADMIN' },
  token: 'token-123',
}

describe('useAuthorizedQuery', () => {
  it('fetches and returns the parsed JSON response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ total: 2 }))
    vi.stubGlobal('fetch', fetchMock)
    const store = makeStore(authenticatedState)

    const { result } = renderHook(
      () => useAuthorizedQuery<{ total: number }>(['users'], '/admin/users'),
      { wrapper: wrapperFor(store) },
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual({ total: 2 })
    vi.unstubAllGlobals()
  })

  it('attaches the bearer token to the request', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({}))
    vi.stubGlobal('fetch', fetchMock)
    const store = makeStore(authenticatedState)

    const { result } = renderHook(() => useAuthorizedQuery(['x'], '/admin/users'), {
      wrapper: wrapperFor(store),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const headers = fetchMock.mock.calls[0][1].headers as Headers
    expect(headers.get('Authorization')).toBe('Bearer token-123')
    vi.unstubAllGlobals()
  })

  it('surfaces a non-2xx response as an ApiRequestError', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 500 }))
    vi.stubGlobal('fetch', fetchMock)
    const store = makeStore(authenticatedState)

    const { result } = renderHook(() => useAuthorizedQuery(['y'], '/admin/users'), {
      wrapper: wrapperFor(store),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toBeInstanceOf(ApiRequestError)
    expect((result.current.error as ApiRequestError).status).toBe(500)
    vi.unstubAllGlobals()
  })

  it('triggers logout on a 401, same as the underlying authorized fetch client', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 401 }))
    vi.stubGlobal('fetch', fetchMock)
    const store = makeStore(authenticatedState)

    const { result } = renderHook(() => useAuthorizedQuery(['z'], '/admin/users'), {
      wrapper: wrapperFor(store),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(store.handleUnauthorized).toHaveBeenCalled()
    expect(store.getState().status).toBe('unauthenticated')
    vi.unstubAllGlobals()
  })
})
