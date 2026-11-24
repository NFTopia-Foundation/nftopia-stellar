import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth/useAuth'
import { AppShell } from './components/AppShell'
import { canManageDlq } from './dlq/access'
import LoginPage from './pages/LoginPage'

// Route-level code splitting — each page is loaded only when navigated to.
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const CollectionsPage = lazy(() => import('./pages/CollectionsPage'))
const UsersPage = lazy(() => import('./pages/UsersPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const ContentFlagsQueuePage = lazy(() => import('./pages/ContentFlagsQueuePage'))
const TransactionRetryPage = lazy(() => import('./pages/TransactionRetryPage'))
const AiUsagePage = lazy(() => import('./pages/AiUsagePage'))
const AuditLogsPage = lazy(() => import('./pages/AuditLogsPage'))

/** Minimal loading indicator shown during lazy-page suspense. */
function PageSpinner() {
  return (
    <div className="flex flex-1 items-center justify-center text-slate-500 text-sm">
      Loading…
    </div>
  )
}

function App() {
  const { state } = useAuth()

  if (state.status !== 'authenticated') {
    return <LoginPage />
  }

  return (
    <BrowserRouter>
      <Suspense fallback={<PageSpinner />}>
        <Routes>
          {/* All authenticated routes render inside the AppShell */}
          <Route element={<AppShell />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/collections" element={<CollectionsPage />} />
            <Route path="/content-flags" element={<ContentFlagsQueuePage />} />
            {/* Operationally sensitive: registered only for roles allowed to manage the DLQ */}
            {canManageDlq(state.user.role) ? (
              <Route path="/transaction-retry" element={<TransactionRetryPage />} />
            ) : null}
            <Route path="/ai-usage" element={<AiUsagePage />} />
            <Route path="/audit-logs" element={<AuditLogsPage />} />
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
