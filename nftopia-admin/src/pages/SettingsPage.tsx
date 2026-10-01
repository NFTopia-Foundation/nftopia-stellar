import { useTranslation } from 'react-i18next'

/**
 * Settings page — stub for future implementation.
 * Renders inside AppShell via <Outlet />.
 */
export default function SettingsPage() {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-white md:text-3xl">
          {t('nav.settings')}
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Configure platform settings and preferences.
        </p>
      </div>

      <div className="rounded-xl border border-white/10 bg-slate-800/50 p-8 text-center text-sm text-slate-500">
        Settings module — coming soon.
      </div>
    </div>
  )
}
