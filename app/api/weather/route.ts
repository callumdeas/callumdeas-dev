import { getCloudflareContext } from '@opennextjs/cloudflare'
import { fromWmo, type WeatherReport } from '../../_lib/weather-types'

/**
 * Current weather where the visitor is. Location comes from Cloudflare's coarse
 * IP geolocation, used only to pick the forecast (never shown or returned); without it (local dev), from the lat/lon the
 * client guessed from its timezone. Coordinates are rounded to half a degree
 * before leaving the Worker, and responses are cached per rounded cell.
 */

const TTL_MS = 15 * 60_000
const cache = new Map<string, { at: number; report: WeatherReport }>()

type Geo = { lat: number; lon: number }

const num = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN
  return Number.isFinite(n) ? n : null
}

const inRange = (lat: number, lon: number) => Math.abs(lat) <= 90 && Math.abs(lon) <= 180

function cloudflareGeo(): Geo | null {
  try {
    const { cf } = getCloudflareContext<Record<string, unknown>>()
    if (!cf) return null
    const lat = num(cf.latitude)
    const lon = num(cf.longitude)
    if (lat === null || lon === null || !inRange(lat, lon)) return null
    return { lat, lon }
  } catch {
    // Not running on Workers (next dev): fall back to the client's guess.
    return null
  }
}

function queryGeo(url: URL): Geo | null {
  const lat = num(url.searchParams.get('lat'))
  const lon = num(url.searchParams.get('lon'))
  if (lat === null || lon === null || !inRange(lat, lon)) return null
  return { lat, lon }
}

const round = (v: number) => Math.round(v * 2) / 2

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null

async function fetchWeather(lat: number, lon: number): Promise<WeatherReport | null> {
  const api = new URL('https://api.open-meteo.com/v1/forecast')
  api.searchParams.set('latitude', String(lat))
  api.searchParams.set('longitude', String(lon))
  api.searchParams.set('current', 'temperature_2m,weather_code,cloud_cover,wind_speed_10m')
  api.searchParams.set('wind_speed_unit', 'ms')
  const res = await fetch(api, { signal: AbortSignal.timeout(4000) })
  if (!res.ok) return null
  const body: unknown = await res.json()
  if (!isRecord(body) || !isRecord(body.current)) return null
  const c = body.current
  const code = num(c.weather_code)
  const cloud = num(c.cloud_cover)
  const temp = num(c.temperature_2m)
  const wind = num(c.wind_speed_10m)
  if (code === null || cloud === null || temp === null) return null
  const cover = Math.min(1, Math.max(0, cloud / 100))
  return { ...fromWmo(code, cover), cloud: cover, wind: wind ?? 3, tempC: temp }
}

export async function GET(request: Request) {
  const geo = cloudflareGeo() ?? queryGeo(new URL(request.url))
  if (!geo) return Response.json({ error: 'no location' }, { status: 400 })

  const lat = round(geo.lat)
  const lon = round(geo.lon)
  const key = `${lat},${lon}`
  const hit = cache.get(key)
  let report = hit && Date.now() - hit.at < TTL_MS ? hit.report : null

  if (!report) {
    try {
      report = await fetchWeather(lat, lon)
      if (!report) return Response.json({ error: 'upstream' }, { status: 502 })
      cache.set(key, { at: Date.now(), report })
      if (cache.size > 500) cache.delete(cache.keys().next().value ?? key)
    } catch {
      return Response.json({ error: 'upstream' }, { status: 502 })
    }
  }

  return Response.json(report, {
    headers: { 'Cache-Control': 'private, max-age=600' },
  })
}
