import { API_BASE_URL } from '../auth/authApi'

export type TimeRange = '24h' | '7d' | '30d' | 'all'

export interface PlatformMetrics {
  totalUsers: number
  totalListings: number
  volume: number
  currency: string
  activeAuctions: number
  timeRange: TimeRange
  updatedAt?: string
}

export class PlatformMetricsApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'PlatformMetricsApiError'
    this.status = status
  }
}

export interface PlatformMetricsApi {
  getMetrics(timeRange?: TimeRange): Promise<PlatformMetrics>
}

/**
 * Unwraps standard backend envelopes (e.g., `{ data: ... }` or `{ ok: true, data: ... }`).
 */
function unwrapPayload(body: unknown): Record<string, unknown> {
  let current = body as Record<string, unknown> | undefined
  while (
    current &&
    typeof current === 'object' &&
    'data' in current &&
    current.data &&
    typeof current.data === 'object' &&
    !Array.isArray(current.data) &&
    !('totalUsers' in current || 'totalListings' in current || 'volume' in current || 'activeAuctions' in current)
  ) {
    current = current.data as Record<string, unknown> | undefined
  }
  return (current ?? {}) as Record<string, unknown>
}

/**
 * Creates an API client for fetching platform-wide metrics with time-range filtering.
 * Connects to the platform metrics backend endpoint with resilient fallback composition.
 */
export function createPlatformMetricsApi(
  fetchImpl: typeof fetch = (...args) => fetch(...args),
  baseUrl: string = API_BASE_URL,
): PlatformMetricsApi {
  return {
    async getMetrics(timeRange: TimeRange = '24h'): Promise<PlatformMetrics> {
      const primaryUrl = `${baseUrl}/admin/metrics?timeRange=${encodeURIComponent(timeRange)}`
      let response: Response

      try {
        response = await fetchImpl(primaryUrl, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
          },
        })

        // Also check /admin/platform-metrics if /admin/metrics returns 404
        if (response.status === 404) {
          const altUrl = `${baseUrl}/admin/platform-metrics?timeRange=${encodeURIComponent(timeRange)}`
          const altResponse = await fetchImpl(altUrl, {
            method: 'GET',
            headers: {
              Accept: 'application/json',
            },
          })
          if (altResponse.ok) {
            response = altResponse
          }
        }
      } catch (err) {
        throw new PlatformMetricsApiError(
          0,
          err instanceof Error ? err.message : 'Network connection failed',
        )
      }

      // If the dedicated platform-wide metrics endpoint exists, return its unwrapped response
      if (response.ok) {
        let json: unknown
        try {
          json = await response.json()
        } catch {
          throw new PlatformMetricsApiError(response.status, 'Invalid JSON response from server')
        }
        const payload = unwrapPayload(json)
        return {
          totalUsers: Number(payload.totalUsers ?? 0),
          totalListings: Number(payload.totalListings ?? 0),
          volume: Number(payload.volume ?? 0),
          currency: String(payload.currency ?? 'XLM'),
          activeAuctions: Number(payload.activeAuctions ?? 0),
          timeRange,
          updatedAt: typeof payload.updatedAt === 'string' ? payload.updatedAt : new Date().toISOString(),
        }
      }

      // If 404, aggregate from individual endpoints as a resilient fallback
      if (response.status === 404) {
        return composeMetricsFromExistingEndpoints(fetchImpl, baseUrl, timeRange)
      }

      // Any other error (401, 403, 500, etc.)
      let message = `Request failed (${response.status})`
      try {
        const errorJson = (await response.json()) as Record<string, unknown>
        if (typeof errorJson?.message === 'string') {
          message = errorJson.message
        } else if (Array.isArray(errorJson?.message)) {
          message = errorJson.message.join(', ')
        }
      } catch {
        // Fall back to default status string
      }
      throw new PlatformMetricsApiError(response.status, message)
    },
  }
}

/**
 * Composes aggregate platform metrics from individual domain endpoints
 * if a single consolidated platform-metrics endpoint is not yet provided by the backend.
 *
 * Time Complexity: O(1) bounded parallel requests
 * Space Complexity: O(1) fixed scalar metrics record
 */
async function composeMetricsFromExistingEndpoints(
  fetchImpl: typeof fetch,
  baseUrl: string,
  timeRange: TimeRange,
): Promise<PlatformMetrics> {
  const [auctionsRes, listingsRes, ordersRes, profilesRes] = await Promise.allSettled([
    fetchImpl(`${baseUrl}/auctions/active`, { headers: { Accept: 'application/json' } }),
    fetchImpl(`${baseUrl}/listings/active`, { headers: { Accept: 'application/json' } }),
    fetchImpl(`${baseUrl}/orders?status=COMPLETED&limit=100`, { headers: { Accept: 'application/json' } }),
    fetchImpl(`${baseUrl}/search?type=profiles`, { headers: { Accept: 'application/json' } }),
  ])

  let activeAuctions = 0
  let totalListings = 0
  let volume = 0
  let totalUsers = 0

  if (auctionsRes.status === 'fulfilled' && auctionsRes.value.ok) {
    try {
      const data = (await auctionsRes.value.json()) as unknown
      if (Array.isArray(data)) {
        activeAuctions = data.length
      } else if (data && typeof data === 'object' && 'total' in data && typeof data.total === 'number') {
        activeAuctions = data.total
      }
    } catch {
      // Keep 0 default on parse issue
    }
  }

  if (listingsRes.status === 'fulfilled' && listingsRes.value.ok) {
    try {
      const data = (await listingsRes.value.json()) as unknown
      if (Array.isArray(data)) {
        totalListings = data.length
      } else if (data && typeof data === 'object' && 'total' in data && typeof data.total === 'number') {
        totalListings = data.total
      }
    } catch {
      // Keep 0 default on parse issue
    }
  }

  if (ordersRes.status === 'fulfilled' && ordersRes.value.ok) {
    try {
      const data = (await ordersRes.value.json()) as {
        items?: Array<{ totalPrice?: string | number; price?: string | number; createdAt?: string }>
      }
      if (Array.isArray(data?.items)) {
        const now = Date.now()
        const cutoff =
          timeRange === '24h'
            ? now - 24 * 60 * 60 * 1000
            : timeRange === '7d'
              ? now - 7 * 24 * 60 * 60 * 1000
              : timeRange === '30d'
                ? now - 30 * 24 * 60 * 60 * 1000
                : 0

        for (const order of data.items) {
          const createdAt = order.createdAt ? new Date(order.createdAt).getTime() : 0
          if (timeRange === 'all' || !cutoff || createdAt >= cutoff) {
            const val = Number(order.totalPrice ?? order.price ?? 0)
            if (Number.isFinite(val) && val > 0) {
              volume += val
            }
          }
        }
      }
    } catch {
      // Keep 0 default on parse issue
    }
  }

  if (profilesRes.status === 'fulfilled' && profilesRes.value.ok) {
    try {
      const data = (await profilesRes.value.json()) as {
        profiles?: { estimatedTotalHits?: number; totalHits?: number; hits?: unknown[] }
        total?: number
      }
      if (typeof data?.profiles?.estimatedTotalHits === 'number') {
        totalUsers = data.profiles.estimatedTotalHits
      } else if (typeof data?.profiles?.totalHits === 'number') {
        totalUsers = data.profiles.totalHits
      } else if (Array.isArray(data?.profiles?.hits)) {
        totalUsers = data.profiles.hits.length
      } else if (typeof data?.total === 'number') {
        totalUsers = data.total
      }
    } catch {
      // Keep 0 default on parse issue
    }
  }

  return {
    totalUsers,
    totalListings,
    volume,
    currency: 'XLM',
    activeAuctions,
    timeRange,
    updatedAt: new Date().toISOString(),
  }
}
