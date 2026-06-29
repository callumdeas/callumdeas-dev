'use client'

import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { HistoryEntry, OutputLine } from '@/lib/terminal/types'
import { executeCommand } from '@/lib/terminal/commands'
import { displayPath, getCompletions, HOME } from '@/lib/terminal/filesystem'
import { TerminalLine } from './TerminalLine'

const C = {
  mauve: '#cba6f7',
  dim: '#6c7086',
  blue: '#89b4fa',
  green: '#a6e3a1',
  text: '#cdd6f4',
  overlay: '#9399b2',
}

// Full-width banner — shown on desktop / wide viewports.
const BANNER_FULL: OutputLine[] = [
  [{ text: '           _ _                     _                     _', color: C.mauve }],
  [{ text: '          | | |                   | |                   | |', color: C.mauve }],
  [{ text: '  ___ __ _| | |_   _ _ __ ___   __| | ___  __ _ ___   __| | _____   __', color: C.mauve }],
  [{ text: " / __/ _` | | | | | | '_ ` _ \\ / _` |/ _ \\/ _` / __| / _` |/ _ \\ \\ / /", color: C.blue }],
  [{ text: '| (_| (_| | | | |_| | | | | | | (_| |  __/ (_| \\__ \\| (_| |  __/\\ V /', color: C.blue }],
  [{ text: ' \\___\\__,_|_|_|\\__,_|_| |_| |_|\\__,_|\\___|\\__,_|___(_)__,_|\\___| \\_/', color: C.blue }],
]

// Compact banner (~41 cols) — shown on mobile / narrow viewports so the art
// doesn't overflow and clip on the right.
const BANNER_COMPACT: { text: string; color: string }[] = [
  { text: '         _ _               _', color: C.mauve },
  { text: ' __ __ _| | |_  _ _ __  __| |___ __ _ ___', color: C.blue },
  { text: "/ _/ _` | | | || | '  \\/ _` / -_) _` (_-<", color: C.blue },
  { text: '\\__\\__,_|_|_|\\_,_|_|_|_\\__,_\\___\\__,_/__/', color: C.blue },
]

// Text that follows the banner — wraps gracefully on narrow screens.
const BOOT_TEXT: OutputLine[] = [
  [{ text: '' }],
  [{ text: ' callumdeas.dev', color: C.mauve, bold: true }, { text: '  —  Personal Terminal', color: C.dim }],
  [{ text: '' }],
  [{ text: ' Type ', color: C.dim }, { text: 'help', color: C.green }, { text: ' to see available commands.', color: C.dim }],
  [{ text: ' Try ', color: C.dim }, { text: 'cat about.md', color: C.green }, { text: ' or ', color: C.dim }, { text: 'ls projects/', color: C.green }, { text: ' to get started.', color: C.dim }],
  [{ text: '' }],
]

export function Terminal() {
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [cwd, setCwd] = useState(HOME)
  const [input, setInput] = useState('')
  const [cmdHistory, setCmdHistory] = useState<string[]>([])
  const [historyIdx, setHistoryIdx] = useState(-1)
  const [inputDraft, setInputDraft] = useState('')

  const inputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Snap to bottom instantly (like a real terminal) before paint — no animation.
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [history])

  // Keyboard avoidance: track the visual viewport so the app shrinks to the
  // area the soft keyboard leaves visible, keeping the input row on screen.
  // (On iOS the layout viewport doesn't change when the keyboard opens, so
  // plain vh/dvh-based heights would hide the prompt behind it.)
  useEffect(() => {
    const vv = window.visualViewport
    const root = document.documentElement
    const apply = () => {
      const h = vv ? vv.height : window.innerHeight
      root.style.setProperty('--app-height', `${Math.round(h)}px`)
    }
    apply()
    vv?.addEventListener('resize', apply)
    vv?.addEventListener('scroll', apply)
    window.addEventListener('resize', apply)
    return () => {
      vv?.removeEventListener('resize', apply)
      vv?.removeEventListener('scroll', apply)
      window.removeEventListener('resize', apply)
    }
  }, [])

  const focusInput = useCallback(() => {
    inputRef.current?.focus()
  }, [])

  // After the keyboard finishes animating in, make sure the latest output and
  // the prompt are scrolled into view above it.
  const handleFocus = useCallback(() => {
    setTimeout(() => {
      const el = scrollRef.current
      if (el) el.scrollTop = el.scrollHeight
      inputRef.current?.scrollIntoView({ block: 'nearest' })
    }, 300)
  }, [])

  const submit = useCallback(() => {
    const trimmed = input.trim()

    const result = executeCommand(cwd, trimmed)

    if (result.action?.type === 'clear') {
      setHistory([])
      setInput('')
      setCmdHistory((prev) => (trimmed ? [trimmed, ...prev] : prev))
      setHistoryIdx(-1)
      return
    }

    if (result.action?.type === 'open') {
      window.open(result.action.url, '_blank', 'noopener,noreferrer')
    }

    setHistory((prev) => [
      ...prev,
      { cwd, command: trimmed, output: result.output },
    ])

    if (trimmed) {
      setCmdHistory((prev) => [trimmed, ...prev.filter((c) => c !== trimmed)])
    }

    if (result.newCwd) setCwd(result.newCwd)
    setInput('')
    setHistoryIdx(-1)
    setInputDraft('')
  }, [cwd, input])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        submit()
        return
      }

      if (e.key === 'c' && e.ctrlKey) {
        e.preventDefault()
        setHistory((prev) => [
          ...prev,
          { cwd, command: input, output: [] },
        ])
        setInput('')
        setHistoryIdx(-1)
        return
      }

      if (e.key === 'l' && e.ctrlKey) {
        e.preventDefault()
        setHistory([])
        return
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault()
        if (cmdHistory.length === 0) return
        const nextIdx = historyIdx + 1
        if (nextIdx >= cmdHistory.length) return
        if (historyIdx === -1) setInputDraft(input)
        setHistoryIdx(nextIdx)
        setInput(cmdHistory[nextIdx])
        return
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        if (historyIdx <= 0) {
          setHistoryIdx(-1)
          setInput(historyIdx === 0 ? inputDraft : '')
          return
        }
        const nextIdx = historyIdx - 1
        setHistoryIdx(nextIdx)
        setInput(cmdHistory[nextIdx])
        return
      }

      if (e.key === 'Tab') {
        e.preventDefault()
        const tokens = input.split(' ')
        if (tokens.length < 2) return
        const partial = tokens[tokens.length - 1]
        const completions = getCompletions(cwd, partial)
        if (completions.length === 1) {
          tokens[tokens.length - 1] = completions[0]
          setInput(tokens.join(' '))
        } else if (completions.length > 1) {
          setHistory((prev) => [
            ...prev,
            {
              cwd,
              command: '',
              output: [completions.map((c) => ({ text: c + '  ', color: C.dim }))],
            },
          ])
        }
        return
      }
    },
    [cmdHistory, cwd, historyIdx, input, inputDraft, submit],
  )

  return (
    <div
      ref={containerRef}
      onClick={focusInput}
      className="flex flex-col h-full cursor-text overflow-hidden"
      style={{ background: '#1e1e2e', color: C.text }}
    >
      {/* Scrollable output area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 pt-4 pb-2 space-y-0.5" style={{ scrollbarWidth: 'thin', scrollbarColor: '#45475a #1e1e2e' }}>
        <TerminalOutput history={history} />
      </div>

      {/* Input row */}
      <div className="px-4 pb-4 flex items-center gap-0 shrink-0">
        <PromptLabel cwd={cwd} />
        <div className="flex-1 relative">
          <input
            ref={inputRef}
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            className="absolute inset-0 w-full bg-transparent border-none outline-none font-mono text-sm caret-transparent opacity-0"
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
          />
          <div className="flex items-center font-mono text-sm pointer-events-none select-none" aria-hidden>
            <span style={{ color: C.text }} className="whitespace-pre">{input}</span>
            <span
              className="inline-block w-[8px] h-[16px] animate-blink"
              style={{ background: C.green, verticalAlign: 'text-bottom' }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// Memoized so typing in the input (which re-renders Terminal on every keystroke)
// does not reconcile the entire scrollback. `history` only changes on submit.
const TerminalOutput = memo(function TerminalOutput({ history }: { history: HistoryEntry[] }) {
  return (
    <>
      {/* Boot banner */}
      <div className="mb-4">
        {/* Full art — wide screens */}
        <div className="hidden sm:block">
          {BANNER_FULL.map((l, i) => (
            <TerminalLine key={i} line={l} />
          ))}
        </div>
        {/* Compact art — narrow screens. Font scales with the viewport so it
            never overflows, capped at the normal size on larger phones. */}
        <div
          className="sm:hidden font-mono leading-tight whitespace-pre"
          style={{ fontSize: 'clamp(8px, 2.7vw, 13px)' }}
        >
          {BANNER_COMPACT.map((l, i) => (
            <div key={i} style={{ color: l.color }}>
              {l.text || ' '}
            </div>
          ))}
        </div>
        {BOOT_TEXT.map((l, i) => (
          <TerminalLine key={i} line={l} wrap />
        ))}
      </div>

      {/* History */}
      {history.map((entry, i) => (
        <div key={i}>
          {entry.command !== '' && (
            <Prompt cwd={entry.cwd} value={entry.command} />
          )}
          {entry.output.map((l, j) => (
            <TerminalLine key={j} line={l} />
          ))}
        </div>
      ))}
    </>
  )
})

function PromptLabel({ cwd }: { cwd: string }) {
  const path = displayPath(cwd)
  return (
    <div className="flex items-center shrink-0 font-mono text-sm select-none">
      <span style={{ color: C.mauve }}>callum</span>
      <span style={{ color: C.dim }}>@callumdeas.dev</span>
      <span style={{ color: C.dim }}>&nbsp;</span>
      <span style={{ color: C.blue }}>{path}</span>
      <span style={{ color: C.green }}>&nbsp;❯&nbsp;</span>
    </div>
  )
}

function Prompt({ cwd, value }: { cwd: string; value: string }) {
  const path = displayPath(cwd)
  return (
    <div className="flex items-start font-mono text-sm select-none">
      <span style={{ color: C.mauve }}>callum</span>
      <span style={{ color: C.dim }}>@callumdeas.dev</span>
      <span style={{ color: C.dim }}>&nbsp;</span>
      <span style={{ color: C.blue }}>{path}</span>
      <span style={{ color: C.green }}>&nbsp;❯&nbsp;</span>
      <span style={{ color: C.text }}>{value}</span>
    </div>
  )
}
