import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth/useAuth'
import { AppShell } from './components/AppShell'
import { ProtectedRoute } from './components/ProtectedRoute'
import { canManageDlq } from './dlq/access'
import LoginPage from './pages/LoginPage'

// Route-level code splitting — each page is loaded only when navigated to.
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const CollectionsPage = lazy(() => import('./pages/CollectionsPage'))
const UsersPage = lazy(() => import('./pages/UsersPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const ContentFlagsQueuePage = lazy(() => import('./pages/ContentFlagsQueuePage'))
const TransactionRetryPage = lazy(() => import('./pages/TransactionRetryPage'))

/** Minimal loading indicator shown during lazy-page suspense. */
function PageSpinner() {
  return (
    <div className="flex flex-1 items-center justify-center text-slate-500 text-sm">
      Loading…
    </div>
  )
}

/**
 * `/login` itself isn't behind ProtectedRoute (that would redirect right
 * back here forever) — once already authenticated, it instead redirects
 * away, so a stale bookmark or back-navigation to /login doesn't strand an
 * authenticated user looking at the login form.
 */
function LoginRoute() {
  const { state } = useAuth()

  if (state.status === 'authenticated') {
    return <Navigate to="/dashboard" replace />
  }

  return <LoginPage />
}

function App() {
  const { state } = useAuth()
  // canManageDlq(undefined) is false, so this stays false — and the route
  // below stays unregistered — for an unauthenticated visitor exactly like
  // it did before ProtectedRoute moved the auth check off this component.
  const dlqAllowed = canManageDlq(state.status === 'authenticated' ? state.user.role : undefined)

  return (
    <BrowserRouter>
      <Suspense fallback={<PageSpinner />}>
        <Routes>
          <Route path="/login" element={<LoginRoute />} />
          {/* All authenticated routes render inside the AppShell */}
          <Route
            element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/collections" element={<CollectionsPage />} />
            <Route path="/content-flags" element={<ContentFlagsQueuePage />} />
            {/* Operationally sensitive: registered only for roles allowed to manage the DLQ */}
            {dlqAllowed ? (
              <Route path="/transaction-retry" element={<TransactionRetryPage />} />
            ) : null}
            <Route path="/settings" element={<SettingsPage />} />
            {/* Catch-all: redirect unknown paths back to dashboard */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

export default App
