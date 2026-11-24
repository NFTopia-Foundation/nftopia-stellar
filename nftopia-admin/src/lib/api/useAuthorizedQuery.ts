import { useQuery, type UseQueryOptions, type UseQueryResult } from '@tanstack/react-query'
import { API_BASE_URL } from '../../auth/authApi'
import { useApiClient } from './useApiClient'

/** Thrown by `useAuthorizedQuery` for any non-2xx response. */
export class ApiRequestError extends Error {
  readonly status: number

  constructor(status: number, message?: string) {
    super(message ?? `Request failed with status ${status}`)
    this.name = 'ApiRequestError'
    this.status = status
  }
}

/**
 * TanStack Query data-fetching/caching layer built on top of the shared
 * authorized client (#561), for use by future admin screens instead of
 * hand-rolled `fetch` + `useState`/`useEffect`.
 *
 * `path` is relative to `API_BASE_URL`. A 401 has already triggered logout
 * via the underlying `createAuthorizedFetch` by the time this throws, so
 * callers don't need to special-case it — `isError`/`error` here just
 * reflects "the request failed," and the auth state change (handled
 * separately by AuthProvider) is what sends the user back to login.
 */
export function useAuthorizedQuery<T>(
  queryKey: readonly unknown[],
  path: string,
  options?: Omit<UseQueryOptions<T>, 'queryKey' | 'queryFn'>,
): UseQueryResult<T> {
  const apiFetch = useApiClient()

  return useQuery<T>({
    queryKey,
    queryFn: async () => {
      const response = await apiFetch(`${API_BASE_URL}${path}`)
      if (!response.ok) {
        throw new ApiRequestError(response.status)
      }
      return (await response.json()) as T
    },
    ...options,
  })
}
