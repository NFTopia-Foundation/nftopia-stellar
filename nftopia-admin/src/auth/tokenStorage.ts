/**
 * Token persistence strategy for the admin console (see README "Authentication"):
 *
 * - Only the short-lived access token is persisted, in `sessionStorage`. It is
 *   scoped to the current tab and discarded when the tab or browser closes.
 * - The refresh token is never stored, so an admin session cannot silently
 *   outlive its access token; when it expires the operator logs in again.
 * - `localStorage` is not used, so sessions are not shared across tabs or kept
 *   across browser restarts.
 */
export interface TokenStorage {
  get(): string | null
  set(token: string): void
  clear(): void
}

export const ACCESS_TOKEN_KEY = 'nftopia-admin.access_token'

export function createSessionTokenStorage(
  getStorage: () => Storage | undefined = () =>
    typeof window === 'undefined' ? undefined : window.sessionStorage,
): TokenStorage {
  return {
    get() {
      try {
        return getStorage()?.getItem(ACCESS_TOKEN_KEY) ?? null
      } catch {
        return null
      }
    },
    set(token) {
      try {
        getStorage()?.setItem(ACCESS_TOKEN_KEY, token)
      } catch {
        // Storage unavailable (private mode, quota): the session stays in memory only.
      }
    },
    clear() {
      try {
        getStorage()?.removeItem(ACCESS_TOKEN_KEY)
      } catch {
        // Nothing persisted to clear.
      }
    },
  }
}
