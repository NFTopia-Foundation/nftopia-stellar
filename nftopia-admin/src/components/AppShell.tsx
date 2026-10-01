import { useState, type ReactNode } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/useAuth'
import { LocaleSwitcher } from './LocaleSwitcher'

// ---------------------------------------------------------------------------
// Icon components (inline SVG, no external icon lib required)
// ---------------------------------------------------------------------------

function DashboardIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      viewBox="0 0 24 24"
    >
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  )
}

function CollectionsIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"
      />
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  )
}

function MenuIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

function UserCircleIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-7 w-7"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      viewBox="0 0 24 24"
    >
      <circle cx="12" cy="8" r="3.25" />
      <path
        strokeLinecap="round"
        d="M4.5 20c0-3.314 3.358-6 7.5-6s7.5 2.686 7.5 6"
      />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Nav items driven by i18n keys
// ---------------------------------------------------------------------------

interface NavItem {
  to: string
  labelKey: string
  icon: ReactNode
}

const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', labelKey: 'nav.dashboard', icon: <DashboardIcon /> },
  { to: '/collections', labelKey: 'nav.collections', icon: <CollectionsIcon /> },
  { to: '/settings', labelKey: 'nav.settings', icon: <SettingsIcon /> },
]

// ---------------------------------------------------------------------------
// Sidebar (shared between desktop pinned and mobile overlay)
// ---------------------------------------------------------------------------

interface SidebarContentProps {
  onNavClick?: () => void
}

function SidebarContent({ onNavClick }: SidebarContentProps) {
  const { t } = useTranslation()

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    [
      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
      isActive
        ? 'bg-cyan-500/15 text-cyan-300'
        : 'text-slate-400 hover:bg-white/5 hover:text-slate-200',
    ].join(' ')

  return (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className="flex h-14 items-center gap-2 border-b border-white/10 px-4 shrink-0">
        <span className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">
          NFTopia
        </span>
        <span className="rounded bg-cyan-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-300">
          Admin
        </span>
      </div>

      {/* Navigation */}
      <nav aria-label="Main navigation" className="flex-1 overflow-y-auto px-2 py-3">
        <ul className="flex flex-col gap-0.5">
          {NAV_ITEMS.map(({ to, labelKey, icon }) => (
            <li key={to}>
              <NavLink to={to} className={navLinkClass} onClick={onNavClick}>
                {icon}
                <span>{t(labelKey)}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}

// ---------------------------------------------------------------------------
// AppShell
// ---------------------------------------------------------------------------

/**
 * Top-level layout shell for all authenticated admin screens.
 *
 * Layout:
 * ┌─────────────┬────────────────────────────────────┐
 * │             │  Header (locale + user)             │
 * │   Sidebar   ├────────────────────────────────────┤
 * │  (240px)    │  <Outlet />  (routed page content)  │
 * │             │                                    │
 * └─────────────┴────────────────────────────────────┘
 *
 * On tablet/mobile (< md) the sidebar collapses into a slide-in drawer
 * triggered by a hamburger button in the header.
 */
export function AppShell() {
  const { t } = useTranslation()
  const { state, store } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Derive display name from auth state
  const displayName =
    state.status === 'authenticated'
      ? (state.user.email ?? state.user.username ?? state.user.id)
      : null

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* ------------------------------------------------------------------ */}
      {/* Desktop sidebar — always visible on md+                             */}
      {/* ------------------------------------------------------------------ */}
      <aside
        aria-label="Sidebar"
        className="hidden md:flex w-60 shrink-0 flex-col border-r border-white/10 bg-slate-900/80"
      >
        <SidebarContent />
      </aside>

      {/* ------------------------------------------------------------------ */}
      {/* Mobile sidebar overlay                                              */}
      {/* ------------------------------------------------------------------ */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
            aria-hidden="true"
            onClick={() => setSidebarOpen(false)}
          />
          {/* Drawer */}
          <aside
            aria-label="Sidebar"
            className="relative z-50 w-60 shrink-0 bg-slate-900 border-r border-white/10 flex flex-col"
          >
            <SidebarContent onNavClick={() => setSidebarOpen(false)} />
          </aside>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Main area: header + content                                         */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-white/10 bg-slate-900/60 px-4 backdrop-blur">
          {/* Mobile menu toggle */}
          <button
            type="button"
            aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
            aria-expanded={sidebarOpen}
            onClick={() => setSidebarOpen((prev) => !prev)}
            className="md:hidden rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-slate-200 transition"
          >
            {sidebarOpen ? <CloseIcon /> : <MenuIcon />}
          </button>

          {/* Mobile brand (only shown on small screens; desktop has sidebar brand) */}
          <span className="md:hidden text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">
            NFTopia <span className="text-slate-400">Admin</span>
          </span>

          {/* Spacer – pushes controls to right on desktop */}
          <div className="hidden md:flex flex-1" aria-hidden="true" />

          {/* Locale switcher */}
          <LocaleSwitcher />

          {/* User indicator */}
          {displayName ? (
            <div className="flex items-center gap-2">
              <div
                className="flex items-center gap-2 rounded-lg border border-white/10 px-2.5 py-1 text-sm text-slate-300"
                aria-label={t('auth.signedInAs', { name: displayName })}
              >
                <UserCircleIcon />
                <span className="hidden sm:block max-w-[10rem] truncate">
                  {displayName}
                </span>
              </div>
              <button
                type="button"
                onClick={() => store.logout()}
                className="rounded-lg border border-white/10 px-3 py-1 text-xs text-slate-200 transition hover:bg-white/10"
              >
                {t('auth.logout')}
              </button>
            </div>
          ) : null}
        </header>

        {/* Scrollable page content */}
        <main
          id="main-content"
          className="flex-1 overflow-y-auto bg-[radial-gradient(900px_circle_at_100%_0%,#123d6333_0%,transparent_50%),radial-gradient(700px_circle_at_0%_100%,#1e3a8a22_0%,transparent_50%)] p-4 md:p-6"
        >
          <Outlet />
        </main>
      </div>
    </div>
  )
}
