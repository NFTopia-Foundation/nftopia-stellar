import type { AuthStore } from './authStore'

/**
 * `fetch` wrapper for admin API calls: attaches the bearer token and ends the
 * session when the backend rejects it (invalid, revoked or expired token),
 * which sends the operator back to the login screen.
 */
export function createAuthorizedFetch(
  store: AuthStore,
  fetchImpl: typeof fetch = (...args) => fetch(...args),
): typeof fetch {
  return async (input, init = {}) => {
    const state = store.getState()
    const headers = new Headers(init.headers)
    if (state.status === 'authenticated') {
      headers.set('Authorization', `Bearer ${state.token}`)
    }

    const response = await fetchImpl(input, { ...init, headers })
    if (response.status === 401) {
      store.handleUnauthorized()
    }
    return response
  }
}
