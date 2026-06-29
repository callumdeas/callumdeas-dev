'use client'

import { Terminal } from './Terminal'

export function TerminalFrame() {
  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden" style={{ background: '#1e1e2e' }}>
      {/* Subtle scanline overlay */}
      <div
        className="absolute inset-0 pointer-events-none z-10"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.06) 2px, rgba(0,0,0,0.06) 4px)',
        }}
      />
      <Terminal />
    </div>
  )
}
