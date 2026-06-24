import { TerminalFrame } from '@/components/TerminalFrame'

export default function Home() {
  return (
    <main
      className="h-full flex items-center justify-center p-4 sm:p-8"
      style={{ background: '#11111b' }}
    >
      {/* Ambient glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 80% 60% at 50% 40%, rgba(137,180,250,0.06) 0%, transparent 70%)',
        }}
      />
      <div className="relative w-full max-w-5xl h-full max-h-[85vh] flex flex-col">
        <TerminalFrame />
      </div>
    </main>
  )
}
