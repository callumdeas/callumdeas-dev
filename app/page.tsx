const LINKS = [
  { label: 'Email', value: 'callumdeas@gmail.com', href: 'mailto:callumdeas@gmail.com' },
  { label: 'GitHub', value: 'github.com/callumdeas', href: 'https://github.com/callumdeas' },
  {
    label: 'LinkedIn',
    value: 'linkedin.com/in/callum-deas',
    href: 'https://uk.linkedin.com/in/callum-deas-a2a861105',
  },
]

const STACK = ['TypeScript', 'React', 'Next.js', 'Node.js', 'PostgreSQL', 'Tailwind CSS', 'Cloudflare']

export default function Home() {
  return (
    <main className="relative min-h-full flex items-center justify-center px-6 py-16 sm:py-24">
      {/* Ambient glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% 30%, rgba(137,180,250,0.07) 0%, transparent 70%)',
        }}
      />

      <div className="relative w-full max-w-xl">
        <p className="text-xs tracking-[0.25em] uppercase" style={{ color: '#89b4fa' }}>
          Coming soon
        </p>

        <h1 className="mt-5 text-3xl sm:text-4xl font-semibold" style={{ color: '#cdd6f4' }}>
          Callum Deas
        </h1>

        <p className="mt-2 text-sm" style={{ color: '#7f849c' }}>
          Software developer · Scotland
        </p>

        <div className="mt-8 h-px w-full" style={{ background: '#313244' }} />

        <div className="mt-8 space-y-4 text-sm leading-relaxed" style={{ color: '#a6adc8' }}>
          <p>
            I build web applications, tools and interactive experiences — with a focus on clean
            interfaces, real-time systems and AI integrations.
          </p>
          <p>
            Most of my work is client projects across hospitality, health and beauty, and events.
            I&apos;m also building <span style={{ color: '#cdd6f4' }}>Knotless</span>, a booking,
            proposal and client management platform for wedding and event professionals. Outside of
            that I ship personal projects — a real-time multiplayer party game and an AI meal
            planner being the current two.
          </p>
          <p>
            A proper site is on the way. In the meantime, the best way to reach me is email.
          </p>
        </div>

        <div className="mt-10">
          <p className="text-xs tracking-[0.2em] uppercase" style={{ color: '#585b70' }}>
            Mostly working in
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {STACK.map((item) => (
              <li
                key={item}
                className="rounded-md px-2.5 py-1 text-xs"
                style={{ background: '#1e1e2e', color: '#a6adc8', border: '1px solid #313244' }}
              >
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-10">
          <p className="text-xs tracking-[0.2em] uppercase" style={{ color: '#585b70' }}>
            Elsewhere
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            {LINKS.map((link) => (
              <li key={link.label} className="flex gap-3">
                <span className="w-20 shrink-0" style={{ color: '#585b70' }}>
                  {link.label}
                </span>
                <a
                  href={link.href}
                  target={link.href.startsWith('http') ? '_blank' : undefined}
                  rel={link.href.startsWith('http') ? 'noreferrer' : undefined}
                  className="underline underline-offset-4 transition-colors hover:opacity-80"
                  style={{ color: '#89b4fa', textDecorationColor: '#45475a' }}
                >
                  {link.value}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  )
}
