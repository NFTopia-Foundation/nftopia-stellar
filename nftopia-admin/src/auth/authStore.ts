import { AuthApiError, type AuthApi, type AuthErrorCode } from './authApi'
import { decodeAccessToken, isAdminClaims, msUntilExpiry } from './jwt'
import type { TokenStorage } from './tokenStorage'

export interface AdminUser {
  id: string
  email: string | null
  username: string | null
  role: string
}

export type AuthError = AuthErrorCode | 'not_admin'

/** Why the user is looking at the login screen, if it was not their choice. */
export type AuthNotice = 'session_expired' | 'logged_out'

type SignedOutState = {
  status: 'unauthenticated'
  error: AuthError | null
  notice: AuthNotice | null
  pending: boolean
}

export type AuthState =
  | SignedOutState
  | { status: 'twoFactor'; tempToken: string; error: AuthError | null; pending: boolean }
  | { status: 'authenticated'; user: AdminUser; token: string }

export interface AuthStore {
  getState(): AuthState
  subscribe(listener: () => void): () => void
  /** Restores a persisted session, discarding it if expired, malformed or non-admin. */
  restore(): void
  login(email: string, password: string): Promise<void>
  verifyTwoFactor(code: string): Promise<void>
  logout(notice?: AuthNotice | null): void
  /** Called when an authenticated request is rejected (e.g. HTTP 401). */
  handleUnauthorized(): void
}

export interface AuthStoreDeps {
  api: AuthApi
  storage: TokenStorage
  now?: () => number
  setTimer?: (callback: () => void, ms: number) => unknown
  clearTimer?: (handle: unknown) => void
}

const signedOut = (
  error: AuthError | null = null,
  notice: AuthNotice | null = null,
): SignedOutState => ({ status: 'unauthenticated', error, notice, pending: false })

// Browsers cap setTimeout delays at 2^31 - 1 ms; longer tokens are re-checked on restore.
const MAX_TIMER_MS = 2_147_483_647

export function createAuthStore({
  api,
  storage,
  now = () => Date.now(),
  setTimer = (callback, ms) => setTimeout(callback, ms),
  clearTimer = (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
}: AuthStoreDeps): AuthStore {
  let state: AuthState = signedOut()
  let expiryTimer: unknown = null
  const listeners = new Set<() => void>()

  function setState(next: AuthState) {
    state = next
    listeners.forEach((listener) => listener())
  }

  function cancelExpiryTimer() {
    if (expiryTimer !== null) {
      clearTimer(expiryTimer)
      expiryTimer = null
    }
  }

  function endSession(next: AuthState) {
    cancelExpiryTimer()
    storage.clear()
    setState(next)
  }

  /** Validates an access token and, if it belongs to an admin, starts the session. */
  function startSession(token: string, fallback?: { email?: string | null; username?: string | null }):
    | 'ok'
    | 'expired'
    | 'invalid'
    | 'not_admin' {
    const claims = decodeAccessToken(token)
    if (!claims) return 'invalid'
    if (!isAdminClaims(claims)) return 'not_admin'

    const remaining = msUntilExpiry(claims, now())
    if (remaining !== null && remaining <= 0) return 'expired'

    cancelExpiryTimer()
    if (remaining !== null) {
      expiryTimer = setTimer(() => {
        expiryTimer = null
        endSession(signedOut(null, 'session_expired'))
      }, Math.min(remaining, MAX_TIMER_MS))
    }

    storage.set(token)
    setState({
      status: 'authenticated',
      token,
      user: {
        id: claims.sub,
        email: claims.email ?? fallback?.email ?? null,
        username: claims.username ?? fallback?.username ?? null,
        role: claims.role as string,
      },
    })
    return 'ok'
  }

  function errorCode(error: unknown): AuthErrorCode {
    return error instanceof AuthApiError ? error.code : 'unknown'
  }

  async function complete(result: Awaited<ReturnType<AuthApi['loginWithEmail']>>) {
    if (result.kind === 'twoFactor') {
      setState({ status: 'twoFactor', tempToken: result.tempToken, error: null, pending: false })
      return
    }

    const outcome = startSession(result.accessToken, result.user)
    if (outcome === 'not_admin') {
      endSession(signedOut('not_admin'))
    } else if (outcome !== 'ok') {
      endSession(signedOut('unknown'))
    }
  }

  return {
    getState: () => state,

    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },

    restore() {
      const token = storage.get()
      if (!token) return
      const outcome = startSession(token)
      if (outcome === 'expired') {
        endSession(signedOut(null, 'session_expired'))
      } else if (outcome !== 'ok') {
        endSession(signedOut())
      }
    },

    async login(email, password) {
      setState({ ...signedOut(), pending: true })
      try {
        await complete(await api.loginWithEmail(email, password))
      } catch (error) {
        endSession(signedOut(errorCode(error)))
      }
    },

    async verifyTwoFactor(code) {
      if (state.status !== 'twoFactor') return
      const { tempToken } = state
      setState({ status: 'twoFactor', tempToken, error: null, pending: true })
      try {
        await complete(await api.verifyTwoFactor(tempToken, code))
      } catch (error) {
        setState({ status: 'twoFactor', tempToken, error: errorCode(error), pending: false })
      }
    },

    logout(notice: AuthNotice | null = 'logged_out') {
      endSession(signedOut(null, notice))
    },

    handleUnauthorized() {
      if (state.status === 'authenticated') {
        endSession(signedOut(null, 'session_expired'))
      }
    },
  }
}
