import { ABOUT, PROJECTS } from './_lib/projects'

const accent = '#ff9d6c'

/**
 * The whole site as plain, server-rendered HTML. It's what crawlers, screen
 * readers, no-JS and no-WebGL visitors get, and the "text version" toggle.
 * When the planet is running it stays in the DOM but visually hidden.
 */
export function StaticSite() {
  return (
    <div id="static-site" className="min-h-full px-5 py-12 sm:py-16" style={{ background: '#11111b', color: '#cdd6f4' }}>
      <div className="mx-auto max-w-2xl">
        <header>
          <p className="text-2xl leading-none" style={{ fontFamily: 'var(--font-pixel), monospace', color: accent }}>
            CALLUMDEAS.DEV
          </p>
          <h1 className="mt-4 text-3xl font-semibold sm:text-4xl">{ABOUT.name}</h1>
          <p className="mt-1 text-sm" style={{ color: '#7f849c' }}>
            {ABOUT.role}
          </p>
          <p className="mt-6 text-sm leading-relaxed" style={{ color: '#a6adc8' }}>
            {ABOUT.summary}
          </p>
          <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            {ABOUT.links.map((l) => (
              <li key={l.href}>
                <a href={l.href} className="underline underline-offset-4 hover:opacity-80" style={{ color: '#89b4fa' }}>
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
          <form action="/" className="mt-6 text-xs" style={{ color: '#7f849c' }}>
            This is the text version.{' '}
            <button type="submit" className="cursor-pointer underline underline-offset-4">
              Visit the planet
            </button>{' '}
            for the full experience (needs WebGL).
          </form>
        </header>

        <main className="mt-12 space-y-12">
          {PROJECTS.map((p) => (
            <section key={p.id} aria-labelledby={`project-${p.id}`}>
              <p className="text-lg leading-none" style={{ fontFamily: 'var(--font-pixel), monospace', color: accent }}>
                ▸ {p.place.toUpperCase()}
              </p>
              <h2 id={`project-${p.id}`} className="mt-2 text-2xl font-semibold">
                {p.name}
              </h2>
              <p className="mt-1 text-xs" style={{ color: '#7f849c' }}>
                {p.kind} · {p.status}
              </p>
              <p className="mt-4 text-sm leading-relaxed" style={{ color: '#a6adc8' }}>
                {p.intro}
              </p>
              <ul className="mt-4 list-disc space-y-1 pl-5 text-sm" style={{ color: '#a6adc8' }}>
                {p.highlights.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
              {p.clients && (
                <ul className="mt-4 space-y-2 text-sm">
                  {p.clients.map((c) => (
                    <li key={c.href}>
                      <a href={c.href} className="underline underline-offset-4 hover:opacity-80" style={{ color: '#89b4fa' }}>
                        {c.name}
                      </a>
                      <span style={{ color: '#a6adc8' }}>: {c.blurb}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-4 text-xs" style={{ color: '#7f849c' }}>
                Built with {p.stack.join(', ')}
              </p>
              {p.links.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-4 text-sm">
                  {p.links.map((l) => (
                    <li key={l.href}>
                      <a href={l.href} className="underline underline-offset-4 hover:opacity-80" style={{ color: '#89b4fa' }}>
                        {l.label}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </main>

        <footer className="mt-16 text-xs" style={{ color: '#585b70' }}>
          © {new Date().getFullYear()} Callum Deas
        </footer>
      </div>
    </div>
  )
}
