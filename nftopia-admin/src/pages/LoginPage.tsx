import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/useAuth'
import { GradientBackground } from '../components/GradientBackground'

const inputClass =
  'mt-1 w-full rounded-lg border border-white/10 bg-slate-800/70 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400'

export default function LoginPage() {
  const { t } = useTranslation()
  const { state, store } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')

  if (state.status === 'authenticated') return null

  const twoFactor = state.status === 'twoFactor'
  const notice = state.status === 'unauthenticated' ? state.notice : null

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (twoFactor) {
      void store.verifyTwoFactor(code.trim())
    } else {
      void store.login(email.trim(), password)
    }
  }

  return (
    <GradientBackground>
    <main className="flex min-h-screen items-center justify-center p-6">
      <form
        onSubmit={onSubmit}
        className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-white/10 bg-slate-900/70 p-6 shadow-2xl backdrop-blur"
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
            NFTopia Admin
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-white">
            {twoFactor ? t('auth.twoFactor.title') : t('auth.login.title')}
          </h1>
          <p className="mt-1 text-sm text-slate-300">
            {twoFactor ? t('auth.twoFactor.help') : t('auth.login.help')}
          </p>
        </div>

        {notice && (
          <p role="status" className="rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-sm text-cyan-200">
            {t(`auth.notice.${notice}`)}
          </p>
        )}

        {state.error && (
          <p role="alert" className="rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-sm text-rose-200">
            {t(`auth.error.${state.error}`)}
          </p>
        )}

        {twoFactor ? (
          <label className="text-sm text-slate-300">
            {t('auth.twoFactor.code')}
            <input
              className={inputClass}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
          </label>
        ) : (
          <>
            <label className="text-sm text-slate-300">
              {t('auth.login.email')}
              <input
                className={inputClass}
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <label className="text-sm text-slate-300">
              {t('auth.login.password')}
              <input
                className={inputClass}
                type="password"
                autoComplete="current-password"
                required
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
          </>
        )}

        <button
          type="submit"
          disabled={state.pending}
          className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {state.pending
            ? t('auth.login.submitting')
            : twoFactor
              ? t('auth.twoFactor.submit')
              : t('auth.login.submit')}
        </button>

        {twoFactor && (
          <button
            type="button"
            onClick={() => store.logout(null)}
            className="text-sm text-slate-400 hover:text-slate-200"
          >
            {t('auth.twoFactor.cancel')}
          </button>
        )}
      </form>
    </main>
    </GradientBackground>
  )
}
