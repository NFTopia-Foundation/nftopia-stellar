import type { ReactNode } from 'react'

interface GradientBackgroundProps {
  children: ReactNode
  className?: string
}

/**
 * Full-screen radial-gradient background used by the login page and other
 * standalone screens that render outside the AppShell.
 */
export function GradientBackground({ children, className = '' }: GradientBackgroundProps) {
  return (
    <div
      className={`min-h-screen bg-[radial-gradient(1200px_circle_at_100%_0%,#123d63_0%,transparent_45%),radial-gradient(900px_circle_at_0%_100%,#1e3a8a_0%,transparent_40%),#020617] ${className}`}
    >
      {children}
    </div>
  )
}
