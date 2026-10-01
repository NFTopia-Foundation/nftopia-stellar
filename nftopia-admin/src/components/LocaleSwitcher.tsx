import { useTranslation } from 'react-i18next'

const LOCALES: { code: string; label: string }[] = [
  { code: 'en', label: 'EN' },
  { code: 'es', label: 'ES' },
]

/**
 * Locale switcher that changes the active language via react-i18next.
 * Designed to sit in the shell header.
 */
export function LocaleSwitcher() {
  const { i18n } = useTranslation()
  const current = i18n.language

  return (
    <div
      role="group"
      aria-label="Language switcher"
      className="flex items-center gap-0.5 rounded-lg border border-white/10 p-0.5"
    >
      {LOCALES.map(({ code, label }) => (
        <button
          key={code}
          type="button"
          onClick={() => void i18n.changeLanguage(code)}
          aria-pressed={current.startsWith(code)}
          className={[
            'rounded-md px-2.5 py-1 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400',
            current.startsWith(code)
              ? 'bg-cyan-500 text-slate-950'
              : 'text-slate-400 hover:text-slate-200',
          ].join(' ')}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
