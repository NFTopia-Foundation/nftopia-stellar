function App() {
  return (
    <main className="min-h-screen bg-[radial-gradient(1200px_circle_at_100%_0%,#123d63_0%,transparent_45%),radial-gradient(900px_circle_at_0%_100%,#1e3a8a_0%,transparent_40%),#020617] p-6 md:p-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 rounded-2xl border border-white/10 bg-slate-900/70 p-6 shadow-2xl backdrop-blur md:p-8">
        <header className="flex flex-col gap-3 border-b border-white/10 pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
              NFTopia Admin
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-white md:text-4xl">
              Tailwind Is Ready
            </h1>
            <p className="mt-2 max-w-xl text-sm text-slate-300 md:text-base">
              The admin app is now fully wired with Tailwind CSS on Vite.
              Start building dashboards, moderation panels, and platform ops tools.
            </p>
          </div>
          <span className="inline-flex w-fit rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300">
            Status: UI system configured
          </span>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <article className="rounded-xl border border-white/10 bg-slate-800/70 p-4">
            <h2 className="text-sm font-medium text-slate-300">Stack</h2>
            <p className="mt-2 text-lg font-semibold text-white">React + Vite</p>
          </article>
          <article className="rounded-xl border border-white/10 bg-slate-800/70 p-4">
            <h2 className="text-sm font-medium text-slate-300">Styling</h2>
            <p className="mt-2 text-lg font-semibold text-white">Tailwind CSS v4</p>
          </article>
          <article className="rounded-xl border border-white/10 bg-slate-800/70 p-4">
            <h2 className="text-sm font-medium text-slate-300">Next Step</h2>
            <p className="mt-2 text-lg font-semibold text-white">Build admin modules</p>
          </article>
        </section>
      </div>
    </main>
  )
}

export default App
