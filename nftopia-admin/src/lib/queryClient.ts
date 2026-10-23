import { QueryClient } from '@tanstack/react-query'

/**
 * Shared TanStack Query cache for the admin app (#561). An admin's view of
 * platform state (user lists, moderation queues, etc.) should lean fresh
 * rather than stale, so queries refetch on window focus and retry sparingly
 * — a failed request to an internal tool is more useful surfaced
 * immediately than silently retried a few times first.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: true,
    },
    mutations: {
      retry: 0,
    },
  },
})
