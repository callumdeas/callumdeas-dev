import { TerminalFrame } from '@/components/TerminalFrame'

export default function Home() {
  return (
    <main
      className="flex overflow-hidden"
      style={{ background: '#1e1e2e', height: 'var(--app-height, 100dvh)' }}
    >
      <div className="relative w-full h-full flex flex-col">
        <TerminalFrame />
      </div>
    </main>
  )
}
