import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useTranslation } from 'react-i18n'
import { useAuth } from './auth/useAuth'
import { AppShell } from './components/AppShell'
import LoginPage from './pages/LoginPage'
import { ContentFlagsQueuePage } from './pages/ContentFlagsQueuePage'

// Route-level code splitting — each page is loaded only when navigated to.
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const CollectionsPage = lazy(() => import('./pages/CollectionsPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))

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
<main className="min-h-screen bg-[radial-gradient(1200px_circle_at_100%_0%,#123d63_0%,transparent_45%),radial-gradient(900px_circle_at_0%_100%,#1e3a8a_0%,transparent_40%),#020617] p-6 md:p-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 rounded-2xl border border-white/10 bg-slate-900/70 p-6 shadow-2xl backdrop-blur md:p-8">
        <header className="flex flex-col gap-3 border-b border-white/10 pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
              NFTopia Admin
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-white md:text-4xl">
              {t('onboarding.welcome')}
            </h1>
            <p className="mt-2 max-w-xl text-sm text-slate-300 md:text-base">
              {t('onboarding.walletHelp')}
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 md:items-end">
            <span className="inline-flex w-fit rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300">
              {t('network.mainnet.label')}
            </span>
            <div className="flex items-center gap-3 text-sm text-slate-300">
              <span>
                {t('auth.signedInAs', {
                  name: state.user.email ?? state.user.username ?? state.user.id,
                })}
              </span>
              <button
                type="button"
                onClick={() => store.logout()}
                className="rounded-lg border border-white/10 px-3 py-1 text-slate-200 transition hover:bg-white/10"
              >
                {t('auth.logout')}
              </button>
            </div>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <article className="rounded-xl border border-white/10 bg-slate-800/70 p-4">
            <h2 className="text-sm font-medium text-slate-300">{t('nav.dashboard')}</h2>
            <p className="mt-2 text-lg font-semibold text-white">{t('wallet.connect.label')}</p>
          </article>
          <article className="rounded-xl border border-white/10 bg-slate-800/70 p-4">
            <h2 className="text-sm font-medium text-slate-300">{t('explorer.tx.label')}</h2>
            <p className="mt-2 text-lg font-semibold text-white">{t('explorer.account.label')}</p>
          </article>
          <article className="rounded-xl border border-white/10 bg-slate-800/70 p-4">
            <h2 className="text-sm font-medium text-slate-300">{t('network.testnet.label')}</h2>
            <p className="mt-2 text-lg font-semibold text-white">{t('wallet.address.label')}</p>
          </article>
        </section>

        <ContentFlagsQueuePage />
      </div>
    </main>
  )
}

export default App
