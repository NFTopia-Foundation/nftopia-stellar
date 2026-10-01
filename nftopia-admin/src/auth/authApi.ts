export const API_BASE_URL: string =
  import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1'

export interface AuthUser {
  id: string
  email?: string | null
  username?: string | null
  role?: string | null
}

export type LoginResult =
  | { kind: 'tokens'; accessToken: string; user: AuthUser }
  | { kind: 'twoFactor'; tempToken: string }

export type AuthErrorCode = 'invalid_credentials' | 'invalid_code' | 'network' | 'unknown'

export class AuthApiError extends Error {
  readonly code: AuthErrorCode

  constructor(code: AuthErrorCode, message?: string) {
    super(message ?? code)
    this.name = 'AuthApiError'
    this.code = code
  }
}

export interface AuthApi {
  loginWithEmail(email: string, password: string): Promise<LoginResult>
  verifyTwoFactor(tempToken: string, code: string): Promise<LoginResult>
}

interface RawAuthPayload {
  access_token?: string
  requiresTwoFactor?: boolean
  tempToken?: string
  user?: AuthUser
}

/** Backend wraps auth payloads as `{ data: { success, data } }` or `{ data }`. */
function unwrap(body: unknown): RawAuthPayload {
  let current = body as Record<string, unknown> | undefined
  while (
    current &&
    typeof current === 'object' &&
    'data' in current &&
    !('access_token' in current) &&
    !('requiresTwoFactor' in current)
  ) {
    current = current.data as Record<string, unknown> | undefined
  }
  return (current ?? {}) as RawAuthPayload
}

function toLoginResult(payload: RawAuthPayload): LoginResult {
  if (payload.requiresTwoFactor && payload.tempToken) {
    return { kind: 'twoFactor', tempToken: payload.tempToken }
  }
  if (payload.access_token && payload.user) {
    return { kind: 'tokens', accessToken: payload.access_token, user: payload.user }
  }
  throw new AuthApiError('unknown', 'Unexpected login response')
}

export function createAuthApi(
  baseUrl: string = API_BASE_URL,
  fetchImpl: typeof fetch = (...args) => fetch(...args),
): AuthApi {
  async function post(path: string, body: unknown, unauthorizedCode: AuthErrorCode) {
    let response: Response
    try {
      response = await fetchImpl(`${baseUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    } catch {
      throw new AuthApiError('network')
    }

    if (response.status === 400 || response.status === 401) {
      throw new AuthApiError(unauthorizedCode)
    }
    if (!response.ok) {
      throw new AuthApiError('unknown', `Request failed with status ${response.status}`)
    }

    return toLoginResult(unwrap(await response.json()))
  }

  return {
    loginWithEmail(email, password) {
      return post('/auth/email/login', { email, password }, 'invalid_credentials')
    },
    verifyTwoFactor(tempToken, code) {
      return post('/auth/2fa/challenge', { tempToken, code }, 'invalid_code')
    },
  }
}
