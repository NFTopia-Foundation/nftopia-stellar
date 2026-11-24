import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'

export interface ProtectedRouteProps {
  children: ReactNode
  /**
   * Reserved for a future narrower-than-"authenticated" gate (#698), e.g.
   * `requireRole="super-admin"`. Not yet enforced — no caller passes it,
   * and no such role exists in the auth system today — but the prop is
   * typed and accepted now so a route can opt into one later without
   * another refactor of every call site.
   */
  requireRole?: string
}

/**
 * Per-route auth gate (#698), extracted from App.tsx's previous single
 * whole-app check so a route can be wrapped individually instead of every
 * route implicitly depending on one top-level `if`. An unauthenticated
 * visit redirects to `/login`; `App.tsx`'s `/login` route itself redirects
 * back once `state.status` becomes `'authenticated'`.
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { state } = useAuth()

  if (state.status !== 'authenticated') {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}
