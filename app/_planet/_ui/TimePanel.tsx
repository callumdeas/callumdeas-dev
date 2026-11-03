'use client'

import { useEffect, useState } from 'react'
import { ART } from '../_lib/art'
import { clock, env, goLive, setSimTime, setSpeed, simNow } from '../_lib/environment'
import { FESTIVAL_LABEL, presetTime, season, type Preset } from '../_lib/seasons'
import { phaseName } from '../_lib/sky'
import { Panel, RetroButton } from './retro'

export const SPEEDS: readonly number[] = [60, 600, 3600]
export const MINUTE = 60_000
export const DAY = 86_400_000

const PRESETS: readonly [Preset, string][] = [
  ['bonfire', 'BONFIRE'],
  ['newyear', 'HOGMANAY'],
  ['halloween', 'HALLOWEEN'],
  ['birthday', 'BIRTHDAY'],
  ['anniversary', 'ANNIV.'],
  ['winter', 'WINTER'],
  ['spring', 'SPRING'],
  ['summer', 'SUMMER'],
  ['autumn', 'AUTUMN'],
]

const pad = (n: number) => String(n).padStart(2, '0')
const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

export function useTick(ms: number) {
  const [, setN] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => setN((n) => n + 1), ms)
    return () => window.clearInterval(id)
  }, [ms])
}

function startOfDay(ms: number) {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** Compact in-world clock for the title card. */
export function ClockLine() {
  useTick(1000)
  const now = new Date(simNow())
  const el = env.sky.sun.elevation
  const icon = el > -1 ? '☀' : '☾'
  return (
    <div className="mt-1 text-lg leading-none opacity-80">
      {icon} {pad(now.getHours())}:{pad(now.getMinutes())} · {env.location.label.toUpperCase()}
      {!clock.live && <span style={{ color: ART.accent }}> · TIME TRAVEL</span>}
      {season.festival && <div className="mt-1" style={{ color: ART.accent }}>★ {FESTIVAL_LABEL[season.festival]} ★</div>}
    </div>
  )
}

/** Review tool: scrub time, fast-forward, jump seasons. */
export function TimePanel() {
  useTick(150)
  const now = new Date(simNow())
  const minutes = now.getHours() * 60 + now.getMinutes()
  const sunEl = env.sky.sun.elevation
  const moon = env.sky.moon
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone

  return (
    <Panel className="w-full max-w-xl px-4 py-3">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-5xl leading-none tabular-nums" style={{ color: ART.accent }}>
            {pad(now.getHours())}:{pad(now.getMinutes())}
            <span className="text-2xl opacity-70">:{pad(now.getSeconds())}</span>
          </div>
          <div className="mt-1 text-lg leading-none opacity-80">
            {DAYS[now.getDay()]} {pad(now.getDate())} {MONTHS[now.getMonth()]} {now.getFullYear()}
          </div>
        </div>
        <div className="text-right text-lg leading-tight">
          <div>
            SUN {sunEl >= 0 ? '+' : ''}
            {sunEl.toFixed(1)}° {env.sky.rising ? '↑' : '↓'}
          </div>
          <div className="opacity-80">
            MOON {Math.round(moon.illumination * 100)}% {phaseName(moon.phaseAngle)}
          </div>
          <div className="opacity-60">
            ≈ {env.location.label.toUpperCase()} ({tz})
          </div>
        </div>
      </div>

      <input
        type="range"
        min={0}
        max={1439}
        value={minutes}
        onChange={(e) => setSimTime(startOfDay(simNow()) + Number(e.target.value) * MINUTE)}
        onPointerUp={(e) => e.currentTarget.blur()}
        className="mt-3 w-full cursor-pointer"
        style={{ accentColor: ART.accent }}
        aria-label="Time of day"
      />

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <RetroButton active={clock.live} onClick={goLive}>
          ● LIVE
        </RetroButton>
        {SPEEDS.map((s) => (
          <RetroButton key={s} active={!clock.live && clock.speed === s} onClick={() => setSpeed(s)}>
            {s}×
          </RetroButton>
        ))}
        <RetroButton active={!clock.live && clock.speed === 0} onClick={() => setSpeed(0)}>
          ❚❚
        </RetroButton>
        <span className="ml-auto flex gap-1.5">
          <RetroButton onClick={() => setSimTime(simNow() - 30 * DAY)}>‹ MONTH</RetroButton>
          <RetroButton onClick={() => setSimTime(simNow() + 30 * DAY)}>MONTH ›</RetroButton>
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-base opacity-60">JUMP</span>
        {PRESETS.map(([preset, label]) => (
          <RetroButton key={preset} onClick={() => setSimTime(presetTime(preset))}>
            {label}
          </RetroButton>
        ))}
      </div>
      <div className="mt-1 text-base leading-none opacity-60">
        {season.name.toUpperCase()}
        {season.festival ? ` · ${FESTIVAL_LABEL[season.festival]}` : ''}
        {season.fireworks > 0 ? ` · FIREWORKS ${Math.round(season.fireworks * 100)}%` : ''}
      </div>
    </Panel>
  )
}
