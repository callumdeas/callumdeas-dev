'use client'

import type { OutputLine } from '@/lib/terminal/types'

interface Props {
  line: OutputLine
}

export function TerminalLine({ line }: Props) {
  if (line.length === 0 || (line.length === 1 && line[0].text === '')) {
    return <div className="min-h-[1.5em]" />
  }

  return (
    <div className="font-mono text-sm leading-relaxed whitespace-pre">
      {line.map((seg, i) => {
        const style: React.CSSProperties = {}
        if (seg.color) style.color = seg.color
        if (seg.bold) style.fontWeight = 'bold'
        if (seg.italic) style.fontStyle = 'italic'
        if (seg.dim) style.opacity = '0.5'

        if (seg.link) {
          return (
            <a
              key={i}
              href={seg.link}
              target="_blank"
              rel="noopener noreferrer"
              style={{ ...style, textDecoration: 'underline', textDecorationColor: seg.color ?? 'currentColor', cursor: 'pointer' }}
            >
              {seg.text}
            </a>
          )
        }

        return (
          <span key={i} style={style}>
            {seg.text}
          </span>
        )
      })}
    </div>
  )
}
