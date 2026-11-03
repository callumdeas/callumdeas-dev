'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { ART } from '../_lib/art'
import { sound } from '../_lib/sound'

export const PANEL_STYLE = {
  background: 'rgba(12, 10, 24, 0.84)',
  border: '2px solid rgba(255,255,255,0.88)',
  boxShadow: '0 0 0 2px rgba(12,10,24,0.9), inset 0 0 0 2px rgba(12,10,24,0.9), 4px 4px 0 0 rgba(0,0,0,0.45)',
}

export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`pointer-events-auto ${className}`} style={PANEL_STYLE}>
      {children}
    </div>
  )
}

export function RetroButton({
  active,
  onClick,
  children,
  title,
}: {
  active?: boolean
  onClick: () => void
  children: ReactNode
  title?: string
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="pointer-events-auto px-2 py-0.5 text-lg leading-none cursor-pointer transition-colors hover:bg-white/15"
      style={{
        background: active ? ART.accent : undefined,
        color: active ? '#120e1c' : '#ffffff',
        border: '1px solid rgba(255,255,255,0.4)',
      }}
    >
      {children}
    </button>
  )
}

export function RetroLink({ href, children }: { href: string; children: ReactNode }) {
  const external = href.startsWith('http')
  return (
    <a
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noreferrer' : undefined}
      className="pointer-events-auto inline-block px-3 py-1 text-xl leading-none transition-transform hover:-translate-y-0.5"
      style={{ background: ART.accent, color: '#120e1c', boxShadow: '3px 3px 0 rgba(0,0,0,0.5)' }}
    >
      {children} ↗
    </a>
  )
}

/** Reveals text a character at a time, like PS1 dialogue boxes. */
export function useTypewriter(text: string, cps = 70, instant = false) {
  const [count, setCount] = useState(instant ? text.length : 0)
  useEffect(() => {
    if (instant) return
    const id = window.setInterval(() => {
      setCount((c) => {
        if (c >= text.length) {
          window.clearInterval(id)
          return c
        }
        if (c % 3 === 0 && text[c] !== ' ') sound.tick()
        return c + 1
      })
    }, 1000 / cps)
    return () => window.clearInterval(id)
  }, [text, cps, instant])
  return { shown: text.slice(0, count), done: count >= text.length, skip: () => setCount(text.length) }
}

export const pixelFont = { fontFamily: 'var(--font-pixel), monospace' }
