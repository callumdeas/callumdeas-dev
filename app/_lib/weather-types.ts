/** Shared between the /api/weather route and the planet. */

export const WEATHER_KINDS = ['clear', 'cloudy', 'overcast', 'fog', 'drizzle', 'rain', 'snow', 'storm'] as const
export type WeatherKind = (typeof WEATHER_KINDS)[number]

export const isWeatherKind = (v: unknown): v is WeatherKind => typeof v === 'string' && WEATHER_KINDS.some((k) => k === v)

export type WeatherReport = {
  kind: WeatherKind
  /** 0..1 strength of the precipitation (or fog). */
  intensity: number
  /** 0..1 cloud cover. */
  cloud: number
  /** m/s at 10m. */
  wind: number
  tempC: number
}

/** WMO weather interpretation code → our weather kind and how heavy it is. */
export function fromWmo(code: number, cloudCover: number): Pick<WeatherReport, 'kind' | 'intensity'> {
  const table: Record<number, [WeatherKind, number]> = {
    45: ['fog', 0.8],
    48: ['fog', 1],
    51: ['drizzle', 0.3],
    53: ['drizzle', 0.45],
    55: ['drizzle', 0.6],
    56: ['drizzle', 0.45],
    57: ['drizzle', 0.6],
    61: ['rain', 0.5],
    63: ['rain', 0.75],
    65: ['rain', 1],
    66: ['rain', 0.6],
    67: ['rain', 0.9],
    71: ['snow', 0.4],
    73: ['snow', 0.7],
    75: ['snow', 1],
    77: ['snow', 0.3],
    80: ['rain', 0.5],
    81: ['rain', 0.75],
    82: ['rain', 1],
    85: ['snow', 0.6],
    86: ['snow', 1],
    95: ['storm', 0.85],
    96: ['storm', 1],
    99: ['storm', 1],
  }
  const hit = table[code]
  if (hit) return { kind: hit[0], intensity: hit[1] }
  if (code === 3 || cloudCover > 0.85) return { kind: 'overcast', intensity: 0 }
  if (code === 1 || code === 2 || cloudCover > 0.35) return { kind: 'cloudy', intensity: 0 }
  return { kind: 'clear', intensity: 0 }
}

export const WEATHER_LABEL: Record<WeatherKind, string> = {
  clear: 'CLEAR',
  cloudy: 'CLOUDY',
  overcast: 'OVERCAST',
  fog: 'FOG',
  drizzle: 'DRIZZLE',
  rain: 'RAIN',
  snow: 'SNOW',
  storm: 'THUNDERSTORM',
}
