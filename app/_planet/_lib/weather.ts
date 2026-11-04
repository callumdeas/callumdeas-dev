import { isWeatherKind, type WeatherKind, type WeatherReport } from '../../_lib/weather-types'
import { smoothstep } from './noise'

/**
 * Live weather for the visitor's location. The report sets targets; the world
 * eases towards them every frame, so changes (or debug overrides) roll in
 * rather than snapping.
 */

type Mix = {
  /** 0..1 how grey and flat the light is. */
  overcast: number
  cloud: number
  rain: number
  snow: number
  fog: number
  storm: number
  wind: number
}

const zero = (): Mix => ({ overcast: 0, cloud: 0.3, rain: 0, snow: 0, fog: 0, storm: 0, wind: 3 })

type WeatherState = {
  /** What the report (or override) says right now. */
  kind: WeatherKind
  report: WeatherReport | null
  source: 'none' | 'live' | 'override'
  target: Mix
  now: Mix
  lying: number
}

export const weather: WeatherState = {
  kind: 'clear',
  report: null,
  source: 'none',
  target: zero(),
  /** Eased values the world reads. */
  now: zero(),
  /** 0..1 snow that has settled during this visit (grows while it snows, melts slowly after). */
  lying: 0,
}

/** Target mix for a kind of weather at a given strength. */
export function mixFor(kind: WeatherKind, intensity: number, cloud: number, wind: number): Mix {
  const i = Math.max(0.3, intensity)
  const m: Mix = { overcast: 0, cloud, rain: 0, snow: 0, fog: 0, storm: 0, wind }
  switch (kind) {
    case 'clear':
      m.cloud = Math.min(cloud, 0.25)
      break
    case 'cloudy':
      m.cloud = Math.max(cloud, 0.5)
      m.overcast = 0.2
      break
    case 'overcast':
      m.cloud = 1
      m.overcast = 0.55
      break
    case 'fog':
      m.cloud = Math.max(cloud, 0.6)
      m.overcast = 0.45
      m.fog = i
      break
    case 'drizzle':
      m.cloud = 1
      m.overcast = 0.55
      m.rain = 0.35 * i + 0.15
      m.fog = 0.25
      break
    case 'rain':
      m.cloud = 1
      m.overcast = 0.6 + 0.15 * i
      m.rain = 0.4 + 0.6 * i
      m.fog = 0.2
      break
    case 'snow':
      m.cloud = 1
      m.overcast = 0.45
      m.snow = 0.4 + 0.6 * i
      m.fog = 0.3
      break
    case 'storm':
      m.cloud = 1
      m.overcast = 0.85
      m.rain = 1
      m.storm = i
      m.fog = 0.2
      m.wind = Math.max(wind, 9)
      break
  }
  return m
}

export function applyReport(report: WeatherReport, source: 'live' | 'override') {
  weather.report = report
  weather.kind = report.kind
  weather.source = source
  weather.target = mixFor(report.kind, report.intensity, report.cloud, report.wind)
}

/** For review: pretend it's a given kind of weather here. */
export function overrideWeather(kind: WeatherKind) {
  applyReport({ kind, intensity: 0.85, cloud: 0.8, wind: kind === 'storm' ? 12 : 4, tempC: kind === 'snow' ? -2 : 9 }, 'override')
}

const KEYS: readonly (keyof Mix)[] = ['overcast', 'cloud', 'rain', 'snow', 'fog', 'storm', 'wind']

/** Ease the live mix towards the target (about 6s), and let snow settle or melt. */
export function stepWeather(dt: number) {
  const k = 1 - Math.exp(-dt / 6)
  for (const key of KEYS) weather.now[key] += (weather.target[key] - weather.now[key]) * k
  const settle = weather.now.snow > 0.2 ? weather.now.snow * 0.95 : 0
  const rate = settle > weather.lying ? 1 / 45 : 1 / 240
  weather.lying += (settle - weather.lying) * (1 - Math.exp(-dt * rate * 4))
}

/** Jump straight to the target (first report, so visitors don't watch the weather arrive). */
export function settleWeather() {
  weather.now = { ...weather.target }
  weather.lying = weather.target.snow > 0.2 ? weather.target.snow * 0.6 : 0
}

export function readOverride(): WeatherKind | null {
  try {
    const v = new URLSearchParams(window.location.search).get('weather')
    return isWeatherKind(v) ? v : null
  } catch {
    return null
  }
}

/** Fetch the live report. Never throws; on any failure the sky simply stays clear. */
export async function loadWeather(lat: number, lon: number): Promise<WeatherReport | null> {
  try {
    const res = await fetch(`/api/weather?lat=${lat.toFixed(1)}&lon=${lon.toFixed(1)}`, { signal: AbortSignal.timeout(6000) })
    if (!res.ok) return null
    const body: unknown = await res.json()
    return isReport(body) ? body : null
  } catch {
    return null
  }
}

function isReport(v: unknown): v is WeatherReport {
  if (typeof v !== 'object' || v === null) return false
  const r: Record<string, unknown> = { ...v }
  return (
    isWeatherKind(r.kind) &&
    typeof r.intensity === 'number' &&
    typeof r.cloud === 'number' &&
    typeof r.wind === 'number' &&
    typeof r.tempC === 'number'
  )
}

/** Convenience for lighting: how much the sun is hidden. */
export const sunHidden = () => smoothstep(0.1, 0.9, weather.now.overcast)

/** °C for most, °F for US English. */
export function formatTemp(c: number) {
  const f = typeof navigator !== 'undefined' && navigator.language === 'en-US'
  return f ? `${Math.round((c * 9) / 5 + 32)}°F` : `${Math.round(c)}°C`
}
