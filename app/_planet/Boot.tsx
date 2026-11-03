/** PS1-style boot card, server-rendered so it shows before any JS runs. */
export function Boot() {
  return (
    <div
      id="boot"
      aria-hidden="true"
      className="fixed inset-0 z-50 flex-col items-center justify-center gap-8 overflow-hidden px-4"
      style={{ background: '#05060c', color: '#fff', fontFamily: 'var(--font-pixel), monospace' }}
    >
      <div style={{ perspective: '400px' }}>
        <svg className="boot-gem" width="84" height="96" viewBox="0 0 84 96" style={{ imageRendering: 'pixelated' }}>
          <polygon points="42,0 84,34 42,96" fill="#ff9d6c" />
          <polygon points="42,0 0,34 42,96" fill="#d0612a" />
          <polygon points="42,0 84,34 0,34" fill="#ffd2b0" />
        </svg>
      </div>
      <div className="text-center">
        <div className="text-4xl leading-none tracking-wider sm:tracking-widest" style={{ color: '#ff9d6c' }}>
          CALLUMDEAS.DEV
        </div>
        <div className="mt-3 text-xl leading-none opacity-70">NOW LOADING</div>
      </div>
      <div className="h-3 w-56 p-0.5" style={{ border: '2px solid rgba(255,255,255,0.85)' }}>
        <div className="boot-bar h-full" style={{ background: '#ff9d6c' }} />
      </div>
      <div className="absolute inset-x-4 bottom-6 text-center text-base opacity-40">© CALLUM DEAS · BEST VIEWED WITH SOUND ON</div>
    </div>
  )
}
