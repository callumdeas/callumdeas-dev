'use client'

import { useRef, useState } from 'react'
import { setStick } from '../_lib/input'

const RADIUS = 46

/** Drag-anywhere-in-the-pad thumbstick for touch screens. */
export function Joystick() {
  const origin = useRef<{ x: number; y: number } | null>(null)
  const [knob, setKnob] = useState({ x: 0, y: 0 })

  const update = (x: number, y: number) => {
    const o = origin.current
    if (!o) return
    let dx = x - o.x
    let dy = y - o.y
    const len = Math.hypot(dx, dy)
    if (len > RADIUS) {
      dx = (dx / len) * RADIUS
      dy = (dy / len) * RADIUS
    }
    setKnob({ x: dx, y: dy })
    setStick(dx / RADIUS, -dy / RADIUS)
  }
  const end = () => {
    origin.current = null
    setKnob({ x: 0, y: 0 })
    setStick(0, 0)
  }

  return (
    <div
      className="pointer-events-auto relative h-32 w-32 touch-none rounded-full"
      style={{ background: 'rgba(12,10,24,0.55)', border: '2px solid rgba(255,255,255,0.7)' }}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        const r = e.currentTarget.getBoundingClientRect()
        origin.current = { x: r.left + r.width / 2, y: r.top + r.height / 2 }
        update(e.clientX, e.clientY)
      }}
      onPointerMove={(e) => update(e.clientX, e.clientY)}
      onPointerUp={end}
      onPointerCancel={end}
      aria-label="Move"
      role="application"
    >
      <div
        className="absolute top-1/2 left-1/2 h-12 w-12 rounded-full"
        style={{
          transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))`,
          background: 'rgba(255,255,255,0.85)',
          boxShadow: '3px 3px 0 rgba(0,0,0,0.45)',
        }}
      />
    </div>
  )
}
