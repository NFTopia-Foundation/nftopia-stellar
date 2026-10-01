import { useEffect, useState, type ReactNode } from 'react'
import { createAuthApi } from './authApi'
import { createAuthStore, type AuthStore } from './authStore'
import { createSessionTokenStorage } from './tokenStorage'
import { AuthContext } from './useAuth'

function createDefaultStore(): AuthStore {
  const store = createAuthStore({
    api: createAuthApi(),
    storage: createSessionTokenStorage(),
  })
  store.restore()
  return store
}

export function AuthProvider({ store, children }: { store?: AuthStore; children: ReactNode }) {
  const [authStore] = useState(() => store ?? createDefaultStore())

  // Re-validate on tab focus so a token that expired while the tab was
  // backgrounded (timers can be throttled) is caught immediately.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') authStore.restore()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [authStore])

  return <AuthContext.Provider value={authStore}>{children}</AuthContext.Provider>
}
