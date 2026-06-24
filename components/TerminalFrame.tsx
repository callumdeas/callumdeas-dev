'use client'

import { Terminal } from './Terminal'

export function TerminalFrame() {
  return (
    <div className="relative w-full max-w-5xl mx-auto h-full flex flex-col" style={{ filter: 'drop-shadow(0 0 40px rgba(137, 180, 250, 0.15)) drop-shadow(0 25px 50px rgba(0,0,0,0.8))' }}>
      {/* Window chrome */}
      <div
        className="flex items-center gap-2 px-4 py-3 rounded-t-xl shrink-0 select-none"
        style={{ background: '#181825', borderBottom: '1px solid #313244' }}
      >
        {/* Traffic lights */}
        <div className="flex items-center gap-1.5">
          <div
            className="w-3 h-3 rounded-full"
            style={{ background: '#ff5f57', boxShadow: '0 0 4px rgba(255,95,87,0.5)' }}
          />
          <div
            className="w-3 h-3 rounded-full"
            style={{ background: '#febc2e', boxShadow: '0 0 4px rgba(254,188,46,0.5)' }}
          />
          <div
            className="w-3 h-3 rounded-full"
            style={{ background: '#28c840', boxShadow: '0 0 4px rgba(40,200,64,0.5)' }}
          />
        </div>

        {/* Title */}
        <div className="flex-1 text-center font-mono text-xs" style={{ color: '#6c7086' }}>
          callum@callumdeas.dev — Terminal
        </div>

        {/* Spacer to balance traffic lights */}
        <div className="w-12" />
      </div>

      {/* Terminal body */}
      <div
        className="flex-1 rounded-b-xl overflow-hidden relative"
        style={{ background: '#1e1e2e' }}
      >
        {/* Subtle scanline overlay */}
        <div
          className="absolute inset-0 pointer-events-none z-10"
          style={{
            backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px)',
            mixBlendMode: 'multiply',
          }}
        />
        <Terminal />
      </div>
    </div>
  )
}
