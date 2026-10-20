/**
 * Top-level platform metrics dashboard tests (issue #566)
 *
 * Validates:
 * 1. API client data fetching, time-range parameterization, unwrapping, and resilient 404 composition.
 * 2. Pure formatting helpers for counts and Stellar native asset (XLM) volume.
 * 3. Server-rendered presentation panel verifying real data binding, loading state, error alert, and time-range controls.
 * 4. Locale parity between English and Spanish for all dashboard keys.
 */

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import '../i18n'
import {
  createPlatformMetricsApi,
  PlatformMetricsApiError,
  type PlatformMetrics,
  type TimeRange,
} from '../metrics/platformMetricsApi'
import { formatCount, formatVolume } from '../metrics/formatMetrics'
import { PlatformMetricsPanel } from '../components/PlatformMetricsPanel'
import DashboardPage from '../pages/DashboardPage'
import enJson from '../locales/en.json'
import esJson from '../locales/es.json'

const BASE_URL = 'http://api.test/api/v1'

const mockMetricsData: PlatformMetrics = {
  totalUsers: 14820,
  totalListings: 3250,
  volume: 845200.5,
  currency: 'XLM',
  activeAuctions: 142,
  timeRange: '24h',
  updatedAt: '2026-10-18T10:00:00.000Z',
}

// ── 1. Formatters ─────────────────────────────────────────────────────────────

describe('Platform Metrics Formatters', () => {
  describe('formatCount', () => {
    it('formats counts with thousands separators', () => {
      expect(formatCount(14820)).toBe('14,820')
      expect(formatCount(1000000)).toBe('1,000,000')
      expect(formatCount(0)).toBe('0')
    })

    it('handles negative or invalid counts safely', () => {
      expect(formatCount(-5)).toBe('0')
      expect(formatCount(null)).toBe('0')
      expect(formatCount(undefined)).toBe('0')
      expect(formatCount(Number.NaN)).toBe('0')
    })
  })

  describe('formatVolume', () => {
    it('formats volume with 2 decimals and XLM currency label', () => {
      expect(formatVolume(845200.5, 'XLM')).toBe('845,200.50 XLM')
      expect(formatVolume(0, 'XLM')).toBe('0.00 XLM')
    })

    it('handles custom currency code', () => {
      expect(formatVolume(100, 'USDC')).toBe('100.00 USDC')
    })

    it('handles invalid volume values safely', () => {
      expect(formatVolume(-10)).toBe('0.00 XLM')
      expect(formatVolume(null)).toBe('0.00 XLM')
      expect(formatVolume(undefined)).toBe('0.00 XLM')
    })
  })
})

// ── 2. API Client ─────────────────────────────────────────────────────────────

describe('PlatformMetricsApi Client', () => {
  let fetchImpl: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchImpl = vi.fn()
  })

  it('fetches metrics for default 24h time-range with correct URL and headers', async () => {
    fetchImpl.mockResolvedValueOnce(
      new Response(JSON.stringify(mockMetricsData), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    const api = createPlatformMetricsApi(fetchImpl as unknown as typeof fetch, BASE_URL)
    const result = await api.getMetrics('24h')

    expect(fetchImpl).toHaveBeenCalledWith(
      `${BASE_URL}/admin/metrics?timeRange=24h`,
      expect.objectContaining({
        method: 'GET',
        headers: { Accept: 'application/json' },
      }),
    )
    expect(result.totalUsers).toBe(14820)
    expect(result.totalListings).toBe(3250)
    expect(result.volume).toBe(845200.5)
    expect(result.activeAuctions).toBe(142)
    expect(result.timeRange).toBe('24h')
  })

  it('supports passing 7d, 30d, and all time-ranges', async () => {
    const api = createPlatformMetricsApi(fetchImpl as unknown as typeof fetch, BASE_URL)

    for (const range of ['7d', '30d', 'all'] as TimeRange[]) {
      fetchImpl.mockResolvedValueOnce(
        new Response(JSON.stringify({ ...mockMetricsData, timeRange: range }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      const res = await api.getMetrics(range)
      expect(res.timeRange).toBe(range)
      expect(fetchImpl).toHaveBeenLastCalledWith(
        `${BASE_URL}/admin/metrics?timeRange=${range}`,
        expect.anything(),
      )
    }
  })

  it('unwraps nested payload envelopes from backend', async () => {
    fetchImpl.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, data: { data: mockMetricsData } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    const api = createPlatformMetricsApi(fetchImpl as unknown as typeof fetch, BASE_URL)
    const result = await api.getMetrics('24h')
    expect(result.totalUsers).toBe(14820)
    expect(result.totalListings).toBe(3250)
  })

  it('falls back to composing from existing domain endpoints when 404 is received', async () => {
    // 1st call to /admin/metrics returns 404
    fetchImpl.mockResolvedValueOnce(new Response('Not Found', { status: 404 }))
    // 2nd call to /admin/platform-metrics returns 404
    fetchImpl.mockResolvedValueOnce(new Response('Not Found', { status: 404 }))
    // 3rd call to /auctions/active returns array of 3 active auctions
    fetchImpl.mockResolvedValueOnce(
      new Response(JSON.stringify([{ id: '1' }, { id: '2' }, { id: '3' }]), { status: 200 }),
    )
    // 4th call to /listings/active returns array of 5 active listings
    fetchImpl.mockResolvedValueOnce(
      new Response(JSON.stringify([{ id: '10' }, { id: '11' }, { id: '12' }, { id: '13' }, { id: '14' }]), {
        status: 200,
      }),
    )
    // 5th call to /orders?status=COMPLETED returns items
    fetchImpl.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          items: [
            { totalPrice: '1500', createdAt: new Date().toISOString() },
            { totalPrice: '500', createdAt: new Date().toISOString() },
          ],
        }),
        { status: 200 },
      ),
    )
    // 6th call to /search?type=profiles returns profiles with totalHits
    fetchImpl.mockResolvedValueOnce(
      new Response(JSON.stringify({ profiles: { totalHits: 42 } }), { status: 200 }),
    )

    const api = createPlatformMetricsApi(fetchImpl as unknown as typeof fetch, BASE_URL)
    const result = await api.getMetrics('24h')

    expect(result.activeAuctions).toBe(3)
    expect(result.totalListings).toBe(5)
    expect(result.volume).toBe(2000)
    expect(result.totalUsers).toBe(42)
    expect(result.currency).toBe('XLM')
    expect(result.timeRange).toBe('24h')
  })

  it('throws PlatformMetricsApiError on 500 error response', async () => {
    fetchImpl.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Internal server error in analytics engine' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    const api = createPlatformMetricsApi(fetchImpl as unknown as typeof fetch, BASE_URL)
    await expect(api.getMetrics('24h')).rejects.toThrow('Internal server error in analytics engine')
  })

  it('handles network failure by throwing PlatformMetricsApiError with status 0', async () => {
    fetchImpl.mockRejectedValueOnce(new Error('Network error'))

    const api = createPlatformMetricsApi(fetchImpl as unknown as typeof fetch, BASE_URL)
    const error = await api.getMetrics('24h').catch((e) => e)

    expect(error).toBeInstanceOf(PlatformMetricsApiError)
    expect(error.status).toBe(0)
    expect(error.message).toBe('Network error')
  })
})

// ── 3. Component Rendering ───────────────────────────────────────────────────

describe('PlatformMetricsPanel Component Rendering', () => {
  it('renders real data-bound stat cards with formatted values', () => {
    const html = renderToStaticMarkup(
      createElement(PlatformMetricsPanel, {
        metrics: mockMetricsData,
        timeRange: '24h',
        onTimeRangeChange: () => {},
        onRefresh: () => {},
        loading: false,
        error: null,
      }),
    )

    // Should display real platform metric values
    expect(html).toContain('14,820')
    expect(html).toContain('3,250')
    expect(html).toContain('845,200.50 XLM')
    expect(html).toContain('142')

    // Should display the real titles
    expect(html).toContain(enJson.dashboard.metrics.totalUsers)
    expect(html).toContain(enJson.dashboard.metrics.totalListings)
    expect(html).toContain(enJson.dashboard.metrics.activeAuctions)

    // Should NOT render static placeholder translation keys
    expect(html).not.toContain('wallet.connect.label')
    expect(html).not.toContain('explorer.tx.label')
    expect(html).not.toContain('explorer.account.label')
    expect(html).not.toContain('wallet.address.label')
  })

  it('renders time-range selector with all required time ranges', () => {
    const html = renderToStaticMarkup(
      createElement(PlatformMetricsPanel, {
        metrics: mockMetricsData,
        timeRange: '7d',
        onTimeRangeChange: () => {},
        onRefresh: () => {},
        loading: false,
        error: null,
      }),
    )

    expect(html).toContain('<select id="platform-time-range"')
    expect(html).toContain('value="24h"')
    expect(html).toContain('value="7d"')
    expect(html).toContain('value="30d"')
    expect(html).toContain('value="all"')
    expect(html).toContain(enJson.dashboard.timeRange['24h'])
    expect(html).toContain(enJson.dashboard.timeRange['7d'])
  })

  it('renders loading announcer when loading', () => {
    const html = renderToStaticMarkup(
      createElement(PlatformMetricsPanel, {
        metrics: null,
        timeRange: '24h',
        onTimeRangeChange: () => {},
        onRefresh: () => {},
        loading: true,
        error: null,
      }),
    )

    expect(html).toContain('role="status"')
    expect(html).toContain(enJson.dashboard.loading)
  })

  it('renders error alert banner with retry button when error is present', () => {
    const html = renderToStaticMarkup(
      createElement(PlatformMetricsPanel, {
        metrics: mockMetricsData,
        timeRange: '24h',
        onTimeRangeChange: () => {},
        onRefresh: () => {},
        loading: false,
        error: 'Unable to reach backend metrics server',
      }),
    )

    expect(html).toContain('role="alert"')
    expect(html).toContain('Unable to reach backend metrics server')
    expect(html).toContain(enJson.dashboard.actions.retry)
  })
})

// ── 4. DashboardPage Full View ───────────────────────────────────────────────

describe('DashboardPage', () => {
  it('renders dashboard page title and platform metrics panel', () => {
    const fakeApi = {
      getMetrics: vi.fn().mockResolvedValue(mockMetricsData),
    }

    const html = renderToStaticMarkup(
      createElement(DashboardPage, { api: fakeApi }),
    )

    expect(html).toContain(enJson.dashboard.title)
    expect(html).toContain(enJson.dashboard.subtitle)
    expect(html).toContain('NFTopia Admin')
  })
})

// ── 5. Locale Parity ──────────────────────────────────────────────────────────

describe('Dashboard Locale Parity', () => {
  it('has a Spanish translation key for every English dashboard key', () => {
    const flattenKeys = (obj: unknown, prefix = ''): string[] => {
      if (obj && typeof obj === 'object') {
        return Object.entries(obj).flatMap(([k, v]) =>
          flattenKeys(v, prefix ? `${prefix}.${k}` : k),
        )
      }
      return [prefix]
    }

    const enDashboardKeys = flattenKeys(enJson.dashboard).sort()
    const esDashboardKeys = flattenKeys(esJson.dashboard).sort()

    expect(esDashboardKeys).toEqual(enDashboardKeys)
  })
})
