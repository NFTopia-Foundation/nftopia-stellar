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

interface StatCardProps {
  label: string
  value: string
}

/**
 * A compact metric/stat card for dashboard-style grids.
 */
export function StatCard({ label, value }: StatCardProps) {
  return (
    <article className="rounded-xl border border-white/10 bg-slate-800/70 p-4">
      <h2 className="text-sm font-medium text-slate-300">{label}</h2>
      <p className="mt-2 text-lg font-semibold text-white">{value}</p>
    </article>
  )
}
