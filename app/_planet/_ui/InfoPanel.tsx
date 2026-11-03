'use client'

import { ART } from '../_lib/art'
import { ABOUT, PROJECTS, projectById, type Project } from '../_lib/projects'
import type { Selection } from '../_lib/selection'
import { PANEL_STYLE, RetroButton, RetroLink, pixelFont, useTypewriter } from './retro'

type Props = {
  selection: Exclude<Selection, null>
  onClose: () => void
  onStep: (dir: 1 | -1) => void
  onSelect: (s: Selection) => void
  reducedMotion: boolean
}

function Heading({ children }: { children: string }) {
  return (
    <div className="mt-5 mb-2 flex items-center gap-2 text-lg leading-none opacity-70">
      <span>{children}</span>
      <span className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.3)' }} />
    </div>
  )
}

function Intro({ text, instant }: { text: string; instant: boolean }) {
  const { shown, done, skip } = useTypewriter(text, 70, instant)
  return (
    <p className="mt-4 min-h-[5.5em] cursor-pointer text-xl leading-snug" onClick={skip} title="Click to skip">
      {shown}
      {!done && <span className="retro-caret">▌</span>}
    </p>
  )
}

function ProjectBody({ project, instant }: { project: Project; instant: boolean }) {
  return (
    <>
      <Intro text={project.intro} instant={instant} />
      <Heading>HIGHLIGHTS</Heading>
      <ul className="space-y-1 text-lg leading-snug">
        {project.highlights.map((h) => (
          <li key={h} className="flex gap-2">
            <span style={{ color: ART.accent }}>►</span>
            <span>{h}</span>
          </li>
        ))}
      </ul>
      {project.clients && (
        <>
          <Heading>SHOPS ON THIS STREET</Heading>
          <ul className="space-y-3">
            {project.clients.map((c) => (
              <li key={c.href}>
                <a
                  href={c.href}
                  target="_blank"
                  rel="noreferrer"
                  className="pointer-events-auto text-xl leading-none underline underline-offset-4 hover:opacity-80"
                  style={{ color: ART.accent, textDecorationColor: 'rgba(255,255,255,0.3)' }}
                >
                  {c.name} ↗
                </a>
                <div className="mt-1 text-lg leading-snug opacity-80">{c.blurb}</div>
              </li>
            ))}
          </ul>
        </>
      )}
      <Heading>BUILT WITH</Heading>
      <ul className="flex flex-wrap gap-1.5">
        {project.stack.map((s) => (
          <li key={s} className="px-2 py-0.5 text-lg leading-none" style={{ border: '1px solid rgba(255,255,255,0.35)' }}>
            {s}
          </li>
        ))}
      </ul>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        {project.links.map((l) => (
          <RetroLink key={l.href} href={l.href}>
            {l.label}
          </RetroLink>
        ))}
        <span className="text-lg opacity-60">STATUS: {project.status.toUpperCase()}</span>
      </div>
    </>
  )
}

function AboutBody({ onSelect, instant }: { onSelect: Props['onSelect']; instant: boolean }) {
  return (
    <>
      <Intro text={ABOUT.intro} instant={instant} />
      <Heading>SAY HELLO</Heading>
      <div className="flex flex-wrap gap-3">
        {ABOUT.links.map((l) => (
          <RetroLink key={l.href} href={l.href}>
            {l.label}
          </RetroLink>
        ))}
      </div>
      <Heading>VISIT</Heading>
      <ul className="space-y-1 text-lg">
        {PROJECTS.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              className="flex w-full cursor-pointer gap-2 text-left hover:opacity-80"
              onClick={() => onSelect({ kind: 'landmark', id: p.id })}
            >
              <span style={{ color: ART.accent }}>►</span>
              <span className="w-36">{p.place}</span>
              <span className="opacity-70">{p.name}</span>
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}

export function InfoPanel({ selection, onClose, onStep, onSelect, reducedMotion }: Props) {
  const project = selection.kind === 'landmark' ? projectById(selection.id) : null
  const key = project ? project.id : 'about'
  return (
    <aside
      key={key}
      className={`${reducedMotion ? '' : 'retro-panel-in '}pointer-events-auto absolute inset-x-2 bottom-2 flex max-h-[58vh] flex-col text-white md:inset-x-auto md:top-4 md:right-4 md:bottom-4 md:max-h-none md:w-[440px]`}
      style={{ ...PANEL_STYLE, ...pixelFont }}
      aria-label={project ? `${project.name} details` : 'About Callum'}
    >
      <header className="px-5 pt-4 pb-3" style={{ borderBottom: '2px solid rgba(255,255,255,0.2)' }}>
        <div className="flex items-start justify-between gap-3">
          <div className="text-lg leading-none" style={{ color: ART.accent }}>
            ▸ {project ? project.place.toUpperCase() : 'BY THE CHAPEL'}
          </div>
          <button type="button" onClick={onClose} className="cursor-pointer text-xl leading-none hover:opacity-70" aria-label="Close">
            ✕
          </button>
        </div>
        <h2 className="mt-2 text-5xl leading-none">{project ? project.name : ABOUT.name}</h2>
        <div className="mt-1 text-lg leading-tight opacity-75">{project ? `${project.kind} · ${project.tagline}` : ABOUT.role}</div>
      </header>

      <div className="retro-scroll flex-1 overflow-y-auto px-5 pb-5">
        {project ? <ProjectBody project={project} instant={reducedMotion} /> : <AboutBody onSelect={onSelect} instant={reducedMotion} />}
      </div>

      <footer className="flex items-center justify-between gap-2 px-5 py-3" style={{ borderTop: '2px solid rgba(255,255,255,0.2)' }}>
        <RetroButton onClick={() => onStep(-1)} title="Previous (←)">
          ◀ PREV
        </RetroButton>
        <span className="hidden text-base opacity-50 sm:inline">ESC TO RETURN</span>
        <RetroButton onClick={() => onStep(1)} title="Next (→)">
          NEXT ▶
        </RetroButton>
      </footer>
    </aside>
  )
}
