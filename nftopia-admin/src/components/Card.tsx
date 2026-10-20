import type { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  /** Whether the card should have the frosted/glassy backdrop-blur appearance */
  glass?: boolean
}

/**
 * Content card with the project's standard dark border + slate background style.
 * Set `glass` to add the backdrop-blur and slightly more transparent background
 * used by the hero panel and login form.
 */
export function Card({ children, className = '', glass = false }: CardProps) {
  return (
    <div
      className={[
        'rounded-2xl border border-white/10 shadow-2xl',
        glass
          ? 'bg-slate-900/70 backdrop-blur'
          : 'bg-slate-800/70',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </div>
  )
}

export interface StatCardProps {
  label: string
  value: string
  subtext?: string
  loading?: boolean
  testId?: string
}

/**
 * A compact metric/stat card for dashboard-style grids.
 */
export function StatCard({ label, value, subtext, loading, testId }: StatCardProps) {
  return (
    <article
      data-testid={testId}
      className="rounded-xl border border-white/10 bg-slate-800/70 p-4 transition-colors"
    >
      <h2 className="text-sm font-medium text-slate-300">{label}</h2>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-white">
        {loading ? <span className="animate-pulse text-slate-500">…</span> : value}
      </p>
      {subtext && <p className="mt-1 text-xs text-slate-400">{subtext}</p>}
    </article>
  )
}
