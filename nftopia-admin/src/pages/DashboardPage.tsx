import { useTranslation } from 'react-i18next'
import { StatCard } from '../components/Card'

/**
 * Dashboard overview page — renders inside AppShell via <Outlet />.
 * Stat cards reuse the extracted StatCard component.
 */
export default function DashboardPage() {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
          NFTopia Admin
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-white md:text-3xl">
          {t('onboarding.welcome')}
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          {t('onboarding.walletHelp')}
        </p>
      </div>

      <section aria-label={t('nav.dashboard')} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label={t('nav.dashboard')} value={t('wallet.connect.label')} />
        <StatCard label={t('explorer.tx.label')} value={t('explorer.account.label')} />
        <StatCard label={t('network.testnet.label')} value={t('wallet.address.label')} />
      </section>
    </div>
  )
}
