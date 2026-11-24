import { useMemo } from 'react'
import { useAuth } from '../../auth/useAuth'
import { createAuthorizedFetch } from '../../auth/authorizedFetch'

/**
 * The shared, authorized `fetch` every screen should use instead of
 * hand-rolling its own (#561) — attaches the bearer token and triggers
 * logout on a 401, same as the inline `useMemo(() => createAuthorizedFetch(store), [store])`
 * pattern UsersPage.tsx already used, just not repeated per screen.
 */
export function useApiClient(): typeof fetch {
  const { store } = useAuth()
  return useMemo(() => createAuthorizedFetch(store), [store])
}
