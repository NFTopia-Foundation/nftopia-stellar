/**
 * Admin authentication flow (issue #560)
 *
 * Covers login success, non-admin rejection, logout, session expiry and the
 * documented token storage strategy.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthApiError, createAuthApi, type AuthApi, type LoginResult } from '../auth/authApi'
import { createAuthStore, type AuthStore } from '../auth/authStore'
import { createAuthorizedFetch } from '../auth/authorizedFetch'
import { decodeAccessToken } from '../auth/jwt'
import { ACCESS_TOKEN_KEY, createSessionTokenStorage, type TokenStorage } from '../auth/tokenStorage'
import enJson from '../locales/en.json'
import esJson from '../locales/es.json'

const NOW = Date.UTC(2026, 8, 29, 12, 0, 0)

function base64Url(value: string): string {
  const binary = String.fromCharCode(...new TextEncoder().encode(value))
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function makeToken(claims: Record<string, unknown>): string {
  return [
    base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' })),
    base64Url(JSON.stringify(claims)),
    'signature',
  ].join('.')
}

const adminToken = (expInSeconds = 900) =>
  makeToken({ sub: 'admin-1', email: 'admin@nftopia.io', role: 'ADMIN', exp: NOW / 1000 + expInSeconds })

const userToken = () =>
  makeToken({ sub: 'user-1', email: 'user@nftopia.io', role: 'USER', exp: NOW / 1000 + 900 })

function tokens(accessToken: string): LoginResult {
  return { kind: 'tokens', accessToken, user: { id: 'x', email: 'fallback@nftopia.io' } }
}

function memoryStorage(initial: string | null = null): TokenStorage & { value: string | null } {
  return {
    value: initial,
    get() {
      return this.value
    },
    set(token) {
      this.value = token
    },
    clear() {
      this.value = null
    },
  }
}

interface Harness {
  store: AuthStore
  storage: ReturnType<typeof memoryStorage>
  api: { loginWithEmail: ReturnType<typeof vi.fn>; verifyTwoFactor: ReturnType<typeof vi.fn> }
  timers: Array<{ callback: () => void; ms: number; cleared: boolean }>
}

function setup(initialToken: string | null = null): Harness {
  const storage = memoryStorage(initialToken)
  const api = { loginWithEmail: vi.fn(), verifyTwoFactor: vi.fn() }
  const timers: Harness['timers'] = []
  const store = createAuthStore({
    api: api as unknown as AuthApi,
    storage,
    now: () => NOW,
    setTimer: (callback, ms) => {
      const timer = { callback, ms, cleared: false }
      timers.push(timer)
      return timer
    },
    clearTimer: (handle) => {
      ;(handle as Harness['timers'][number]).cleared = true
    },
  })
  return { store, storage, api, timers }
}

describe('admin auth — login success', () => {
  it('authenticates an ADMIN account and persists the access token', async () => {
    const { store, storage, api } = setup()
    const token = adminToken()
    api.loginWithEmail.mockResolvedValue(tokens(token))

    await store.login('admin@nftopia.io', 'Secret123!')

    expect(api.loginWithEmail).toHaveBeenCalledWith('admin@nftopia.io', 'Secret123!')
    const state = store.getState()
    expect(state.status).toBe('authenticated')
    if (state.status !== 'authenticated') throw new Error('unreachable')
    expect(state.user).toEqual({
      id: 'admin-1',
      email: 'admin@nftopia.io',
      username: null,
      role: 'ADMIN',
    })
    expect(state.token).toBe(token)
    expect(storage.value).toBe(token)
  })

  it('completes login through the two-factor step for admins with 2FA enabled', async () => {
    const { store, api } = setup()
    api.loginWithEmail.mockResolvedValue({ kind: 'twoFactor', tempToken: 'temp-1' })
    api.verifyTwoFactor.mockResolvedValue(tokens(adminToken()))

    await store.login('admin@nftopia.io', 'Secret123!')
    expect(store.getState().status).toBe('twoFactor')

    await store.verifyTwoFactor('123456')
    expect(api.verifyTwoFactor).toHaveBeenCalledWith('temp-1', '123456')
    expect(store.getState().status).toBe('authenticated')
  })

  it('notifies subscribers when auth state changes', async () => {
    const { store, api } = setup()
    api.loginWithEmail.mockResolvedValue(tokens(adminToken()))
    const listener = vi.fn()
    store.subscribe(listener)

    await store.login('admin@nftopia.io', 'Secret123!')

    expect(listener).toHaveBeenCalled()
  })
})

describe('admin auth — login rejection', () => {
  it('rejects a non-admin account with a not_admin error and stores nothing', async () => {
    const { store, storage, api } = setup()
    api.loginWithEmail.mockResolvedValue(tokens(userToken()))

    await store.login('user@nftopia.io', 'Secret123!')

    expect(store.getState()).toMatchObject({ status: 'unauthenticated', error: 'not_admin' })
    expect(storage.value).toBeNull()
  })

  it('rejects a token that carries no role claim', async () => {
    const { store, storage, api } = setup()
    api.loginWithEmail.mockResolvedValue(tokens(makeToken({ sub: 'legacy', exp: NOW / 1000 + 900 })))

    await store.login('legacy@nftopia.io', 'Secret123!')

    expect(store.getState()).toMatchObject({ status: 'unauthenticated', error: 'not_admin' })
    expect(storage.value).toBeNull()
  })

  it('rejects a non-admin account after the two-factor step as well', async () => {
    const { store, storage, api } = setup()
    api.loginWithEmail.mockResolvedValue({ kind: 'twoFactor', tempToken: 'temp-1' })
    api.verifyTwoFactor.mockResolvedValue(tokens(userToken()))

    await store.login('user@nftopia.io', 'Secret123!')
    await store.verifyTwoFactor('123456')

    expect(store.getState()).toMatchObject({ status: 'unauthenticated', error: 'not_admin' })
    expect(storage.value).toBeNull()
  })

  it('surfaces invalid credentials from the API', async () => {
    const { store, api } = setup()
    api.loginWithEmail.mockRejectedValue(new AuthApiError('invalid_credentials'))

    await store.login('admin@nftopia.io', 'WrongPass1!')

    expect(store.getState()).toMatchObject({ status: 'unauthenticated', error: 'invalid_credentials' })
  })

  it('has a clear, translated message for every login error', () => {
    for (const locale of [enJson, esJson]) {
      for (const code of ['not_admin', 'invalid_credentials', 'invalid_code', 'network', 'unknown']) {
        const message = (locale.auth.error as Record<string, string>)[code]
        expect(typeof message).toBe('string')
        expect(message.length).toBeGreaterThan(0)
      }
    }
    expect(enJson.auth.error.not_admin).toMatch(/admin/i)
  })
})

describe('admin auth — logout', () => {
  it('clears all auth state, storage and the expiry timer', async () => {
    const { store, storage, api, timers } = setup()
    api.loginWithEmail.mockResolvedValue(tokens(adminToken()))
    await store.login('admin@nftopia.io', 'Secret123!')

    store.logout()

    expect(store.getState()).toEqual({
      status: 'unauthenticated',
      error: null,
      notice: 'logged_out',
      pending: false,
    })
    expect(storage.value).toBeNull()
    expect(timers[0].cleared).toBe(true)
  })

  it('does not restore a session after logout', async () => {
    const { store, api } = setup()
    api.loginWithEmail.mockResolvedValue(tokens(adminToken()))
    await store.login('admin@nftopia.io', 'Secret123!')
    store.logout()

    store.restore()

    expect(store.getState().status).toBe('unauthenticated')
  })
})

describe('admin auth — session expiry', () => {
  it('returns to login with a session_expired notice when the token expires', async () => {
    const { store, storage, api, timers } = setup()
    api.loginWithEmail.mockResolvedValue(tokens(adminToken(60)))
    await store.login('admin@nftopia.io', 'Secret123!')

    expect(timers).toHaveLength(1)
    expect(timers[0].ms).toBe(60_000)
    timers[0].callback()

    expect(store.getState()).toMatchObject({ status: 'unauthenticated', notice: 'session_expired' })
    expect(storage.value).toBeNull()
  })

  it('restores a valid persisted admin session', () => {
    const token = adminToken()
    const { store } = setup(token)

    store.restore()

    expect(store.getState()).toMatchObject({ status: 'authenticated', token })
  })

  it('discards an expired persisted token and shows the expiry notice', () => {
    const { store, storage } = setup(adminToken(-1))

    store.restore()

    expect(store.getState()).toMatchObject({ status: 'unauthenticated', notice: 'session_expired' })
    expect(storage.value).toBeNull()
  })

  it('discards a malformed persisted token', () => {
    const { store, storage } = setup('not-a-jwt')

    store.restore()

    expect(store.getState()).toMatchObject({ status: 'unauthenticated', notice: null })
    expect(storage.value).toBeNull()
  })

  it('logs out when an authenticated request is rejected with 401', async () => {
    const { store, storage, api } = setup()
    const token = adminToken()
    api.loginWithEmail.mockResolvedValue(tokens(token))
    await store.login('admin@nftopia.io', 'Secret123!')

    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 401 }))
    const authorizedFetch = createAuthorizedFetch(store, fetchImpl)
    await authorizedFetch('https://api.example/admin/stats')

    const headers = fetchImpl.mock.calls[0][1].headers as Headers
    expect(headers.get('Authorization')).toBe(`Bearer ${token}`)
    expect(store.getState()).toMatchObject({ status: 'unauthenticated', notice: 'session_expired' })
    expect(storage.value).toBeNull()
  })
})

describe('admin auth — token storage strategy', () => {
  let backing: Map<string, string>
  let storage: Storage

  beforeEach(() => {
    backing = new Map()
    storage = {
      getItem: (key) => backing.get(key) ?? null,
      setItem: (key, value) => void backing.set(key, value),
      removeItem: (key) => void backing.delete(key),
      clear: () => backing.clear(),
      key: () => null,
      get length() {
        return backing.size
      },
    }
  })

  it('persists only the access token under a namespaced sessionStorage key', () => {
    const tokenStorage = createSessionTokenStorage(() => storage)
    tokenStorage.set('abc')
    expect(backing.get(ACCESS_TOKEN_KEY)).toBe('abc')
    expect(tokenStorage.get()).toBe('abc')
    tokenStorage.clear()
    expect(backing.size).toBe(0)
  })

  it('never persists the refresh token returned by the backend', async () => {
    const token = adminToken()
    const fetchImpl = vi.fn().mockResolvedValue(
      Response.json({
        data: {
          success: true,
          data: {
            access_token: token,
            refresh_token: 'refresh-secret',
            user: { id: 'admin-1', email: 'admin@nftopia.io', role: 'ADMIN' },
          },
        },
      }),
    )
    const store = createAuthStore({
      api: createAuthApi('https://api.example', fetchImpl),
      storage: createSessionTokenStorage(() => storage),
      now: () => NOW,
      setTimer: () => null,
      clearTimer: () => {},
    })

    await store.login('admin@nftopia.io', 'Secret123!')

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.example/auth/email/login',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(store.getState().status).toBe('authenticated')
    expect([...backing.values()]).toEqual([token])
  })

  it('falls back to memory-only when storage is unavailable', () => {
    const tokenStorage = createSessionTokenStorage(() => {
      throw new Error('SecurityError')
    })
    expect(() => tokenStorage.set('abc')).not.toThrow()
    expect(tokenStorage.get()).toBeNull()
  })
})

describe('admin auth — API client', () => {
  it('maps a 401 login response to invalid_credentials', async () => {
    const api = createAuthApi('https://api.example', vi.fn().mockResolvedValue(new Response(null, { status: 401 })))
    await expect(api.loginWithEmail('a@b.io', 'Secret123!')).rejects.toMatchObject({
      code: 'invalid_credentials',
    })
  })

  it('maps a network failure to network', async () => {
    const api = createAuthApi('https://api.example', vi.fn().mockRejectedValue(new TypeError('fetch failed')))
    await expect(api.loginWithEmail('a@b.io', 'Secret123!')).rejects.toMatchObject({ code: 'network' })
  })

  it('parses the two-factor challenge response', async () => {
    const api = createAuthApi(
      'https://api.example',
      vi.fn().mockResolvedValue(
        Response.json({ data: { success: true, data: { requiresTwoFactor: true, tempToken: 'temp-1' } } }),
      ),
    )
    await expect(api.loginWithEmail('a@b.io', 'Secret123!')).resolves.toEqual({
      kind: 'twoFactor',
      tempToken: 'temp-1',
    })
  })

  it('decodes base64url JWT payloads', () => {
    expect(decodeAccessToken(makeToken({ sub: 'ä-1', role: 'ADMIN' }))).toEqual({ sub: 'ä-1', role: 'ADMIN' })
    expect(decodeAccessToken('a.b')).toBeNull()
  })
})
