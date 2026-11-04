import { smoothstep } from './noise'

/**
 * Seasons and festivals, driven by the simulated clock (so the debug time tools
 * can preview them) and the visitor's hemisphere.
 */

export type SeasonName = 'winter' | 'spring' | 'summer' | 'autumn'
export type Festival = 'halloween' | 'bonfire' | 'christmas' | 'newyear' | 'birthday' | 'anniversary'

export type SeasonState = {
  /** Blend weights, summing to 1. */
  winter: number
  spring: number
  summer: number
  autumn: number
  /** The dominant season. */
  name: SeasonName
  festival: Festival | null
  /** 0..1: how busy the sky is with fireworks right now (before the night gate). */
  fireworks: number
  /** Minimum snow on the ground for festive reasons (Christmas week). */
  festiveSnow: number
}

export const season: SeasonState = {
  winter: 0,
  spring: 0,
  summer: 1,
  autumn: 0,
  name: 'summer',
  festival: null,
  fireworks: 0,
  festiveSnow: 0,
}

const DAY = 86_400_000

/** Mid-points of each (northern) season as day-of-year. */
const CENTRES: readonly [SeasonName, number][] = [
  ['winter', 15],
  ['spring', 106],
  ['summer', 197],
  ['autumn', 289],
]

function dayOfYear(d: Date) {
  const start = new Date(d.getFullYear(), 0, 1)
  return (d.getTime() - start.getTime()) / DAY
}

/** Signed distance in days between two days-of-year, wrapping the year. */
function wrapDays(a: number, b: number) {
  const diff = (((a - b) % 365.25) + 365.25) % 365.25
  return diff > 182.6 ? diff - 365.25 : diff
}

/** Fractional hours since local midnight of the given month/day this year. */
function hoursSince(d: Date, month: number, day: number, year = d.getFullYear()) {
  return (d.getTime() - new Date(year, month, day).getTime()) / 3_600_000
}

/** Bonfire Night: the odd firework all week, a proper show on the 5th (and the weekend nearest it). */
function bonfireFireworks(d: Date) {
  const h = hoursSince(d, 10, 5)
  if (h < -4 * 24 || h > 3 * 24) return 0
  const onTheNight = h >= 0 && h < 30 ? 1 : 0
  const weekend = d.getDay() === 5 || d.getDay() === 6 ? 0.6 : 0
  return Math.max(onTheNight, weekend, 0.18)
}

/** Hogmanay: building from the evening, a huge burst at midnight, tailing off by 2am. */
function newYearFireworks(d: Date) {
  const eve = hoursSince(d, 11, 31)
  const after = hoursSince(d, 0, 1)
  if (eve >= 18 && eve < 24) return 0.12 + 0.88 * smoothstep(23.5, 24, eve)
  if (after >= 0 && after < 2) return 1 - smoothstep(0.25, 2, after)
  return 0
}

/** Callum's birthday: a small show after dark on the day itself. */
function birthdayFireworks(d: Date) {
  return d.getMonth() === 3 && d.getDate() === 26 ? 0.45 : 0
}

function festivalFor(d: Date): Festival | null {
  const m = d.getMonth()
  const day = d.getDate()
  if (m === 3 && day === 26) return 'birthday'
  if (m === 4 && day === 25) return 'anniversary'
  if ((m === 11 && day === 31) || (m === 0 && day === 1)) return 'newyear'
  if ((m === 9 && day >= 24) || (m === 10 && day === 1 && d.getHours() < 6)) return 'halloween'
  if (m === 10 && day >= 1 && day <= 8) return 'bonfire'
  if (m === 11 || (m === 0 && day <= 5)) return 'christmas'
  return null
}

export function updateSeason(ms: number, lat: number) {
  const d = new Date(ms)
  // Southern hemisphere: the seasons flip (festivals keep their dates).
  const doy = dayOfYear(d) + (lat < 0 ? 182.6 : 0)
  let total = 0
  let best: SeasonName = 'summer'
  let bestW = -1
  for (const [name, centre] of CENTRES) {
    const w = Math.max(0, 1 - Math.abs(wrapDays(doy, centre)) / 91.3)
    season[name] = w
    total += w
    if (w > bestW) {
      bestW = w
      best = name
    }
  }
  for (const [name] of CENTRES) season[name] /= total || 1
  season.name = best

  season.festival = festivalFor(d)
  season.fireworks = Math.max(bonfireFireworks(d), newYearFireworks(d), birthdayFireworks(d))
  const xmas = hoursSince(d, 11, 24)
  season.festiveSnow = lat >= 0 && xmas > -4 * 24 && xmas < 3 * 24 ? 0.55 : 0
}

export const FESTIVAL_LABEL: Record<Festival, string> = {
  halloween: 'HALLOWEEN',
  bonfire: 'BONFIRE NIGHT',
  christmas: 'CHRISTMAS',
  newyear: 'HOGMANAY',
  birthday: "IT'S CALLUM'S BIRTHDAY",
  anniversary: 'HAPPY ANNIVERSARY',
}

/** Debug presets: local wall-clock moments worth reviewing. */
export type Preset = 'bonfire' | 'newyear' | 'halloween' | 'birthday' | 'anniversary' | SeasonName

export function presetTime(preset: Preset): number {
  const y = new Date().getFullYear()
  switch (preset) {
    case 'bonfire':
      return new Date(y, 10, 5, 20, 30).getTime()
    case 'newyear':
      return new Date(y, 11, 31, 23, 58).getTime()
    case 'halloween':
      return new Date(y, 9, 31, 21, 0).getTime()
    case 'birthday':
      return new Date(y, 3, 26, 19, 0).getTime()
    case 'anniversary':
      return new Date(y, 4, 25, 18, 0).getTime()
    case 'winter':
      return new Date(y, 0, 20, 13, 0).getTime()
    case 'spring':
      return new Date(y, 3, 20, 13, 0).getTime()
    case 'summer':
      return new Date(y, 6, 15, 13, 0).getTime()
    case 'autumn':
      return new Date(y, 9, 12, 13, 0).getTime()
  }
}
