export interface AccessTokenClaims {
  sub: string
  email?: string
  username?: string
  role?: string
  exp?: number
}

/** Roles allowed to use the admin console (matches backend `UserRole.ADMIN`). */
export const ADMIN_ROLES: readonly string[] = ['ADMIN']

function base64UrlDecode(segment: string): string {
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
  const binary = atob(padded)
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

/**
 * Reads the payload of a JWT without verifying its signature. Signature
 * verification is the backend's job; the client only uses the claims to
 * decide what to render and when the session expires.
 */
export function decodeAccessToken(token: string): AccessTokenClaims | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null

  try {
    const claims = JSON.parse(base64UrlDecode(parts[1])) as unknown
    if (!claims || typeof claims !== 'object') return null
    if (typeof (claims as AccessTokenClaims).sub !== 'string') return null
    return claims as AccessTokenClaims
  } catch {
    return null
  }
}

export function isAdminClaims(claims: AccessTokenClaims): boolean {
  return typeof claims.role === 'string' && ADMIN_ROLES.includes(claims.role)
}

/** Milliseconds until the token expires, or `null` when it has no `exp`. */
export function msUntilExpiry(claims: AccessTokenClaims, now: number): number | null {
  if (typeof claims.exp !== 'number') return null
  return claims.exp * 1000 - now
}
