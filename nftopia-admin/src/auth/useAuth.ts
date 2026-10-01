import { createContext, useContext, useSyncExternalStore } from 'react'
import type { AuthState, AuthStore } from './authStore'

export const AuthContext = createContext<AuthStore | null>(null)

export function useAuth(): { state: AuthState; store: AuthStore } {
  const store = useContext(AuthContext)
  if (!store) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  const state = useSyncExternalStore(store.subscribe, store.getState)
  return { state, store }
}
