/**
 * Low-precision ephemeris (±1°, plenty for lighting): real sun & moon
 * positions plus lunar phase for a given instant and observer location.
 */

const RAD = Math.PI / 180
const DEG = 180 / Math.PI
const mod = (a: number, n: number) => ((a % n) + n) % n

export type Horizontal = { elevation: number; azimuth: number }

export type Location = { lat: number; lon: number; label: string; source: 'timezone' | 'offset' }

type Equatorial = { ra: number; dec: number }

const daysSinceJ2000 = (ms: number) => ms / 86400000 + 2440587.5 - 2451545.0

function toHorizontal({ ra, dec }: Equatorial, d: number, loc: Location): Horizontal {
  const gmstDeg = mod(280.46061837 + 360.98564736629 * d, 360)
  const ha = (gmstDeg + loc.lon - ra) * RAD
  const lat = loc.lat * RAD
  const decR = dec * RAD
  const sinAlt = Math.sin(lat) * Math.sin(decR) + Math.cos(lat) * Math.cos(decR) * Math.cos(ha)
  const elevation = Math.asin(sinAlt) * DEG
  // Azimuth measured from north, clockwise (east = 90°).
  const az = Math.atan2(Math.sin(ha), Math.cos(ha) * Math.sin(lat) - Math.tan(decR) * Math.cos(lat)) * DEG + 180
  return { elevation, azimuth: mod(az, 360) }
}

function eclipticToEquatorial(lambda: number, beta: number, d: number): Equatorial {
  const eps = (23.439 - 0.0000004 * d) * RAD
  const l = lambda * RAD
  const b = beta * RAD
  const ra = Math.atan2(Math.sin(l) * Math.cos(eps) - Math.tan(b) * Math.sin(eps), Math.cos(l)) * DEG
  const dec = Math.asin(Math.sin(b) * Math.cos(eps) + Math.cos(b) * Math.sin(eps) * Math.sin(l)) * DEG
  return { ra: mod(ra, 360), dec }
}

function sunEclipticLongitude(d: number): number {
  const L = mod(280.46 + 0.9856474 * d, 360)
  const g = mod(357.528 + 0.9856003 * d, 360) * RAD
  return mod(L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g), 360)
}

function moonEcliptic(d: number) {
  const L = mod(218.316 + 13.176396 * d, 360)
  const M = mod(134.963 + 13.064993 * d, 360) * RAD
  const F = mod(93.272 + 13.22935 * d, 360) * RAD
  return { lambda: mod(L + 6.289 * Math.sin(M), 360), beta: 5.128 * Math.sin(F) }
}

export type SkyState = {
  sun: Horizontal
  moon: Horizontal & {
    /** Sun→moon elongation in degrees: 0 new, 90 first quarter, 180 full, 270 last quarter. */
    phaseAngle: number
    illumination: number
  }
  /** True while the sun is climbing (morning). */
  rising: boolean
}

export function computeSky(ms: number, loc: Location): SkyState {
  const d = daysSinceJ2000(ms)
  const sunLon = sunEclipticLongitude(d)
  const sun = toHorizontal(eclipticToEquatorial(sunLon, 0, d), d, loc)
  const sunLater = toHorizontal(eclipticToEquatorial(sunLon, 0, d + 1 / 1440), d + 1 / 1440, loc)
  const m = moonEcliptic(d)
  const moonPos = toHorizontal(eclipticToEquatorial(m.lambda, m.beta, d), d, loc)
  const phaseAngle = mod(m.lambda - sunLon, 360)
  return {
    sun,
    moon: { ...moonPos, phaseAngle, illumination: (1 - Math.cos(phaseAngle * RAD)) / 2 },
    rising: sunLater.elevation > sun.elevation,
  }
}

export function phaseName(angle: number): string {
  if (angle < 10 || angle >= 350) return 'NEW MOON'
  if (angle < 80) return 'WAXING CRESCENT'
  if (angle < 100) return 'FIRST QUARTER'
  if (angle < 170) return 'WAXING GIBBOUS'
  if (angle < 190) return 'FULL MOON'
  if (angle < 260) return 'WANING GIBBOUS'
  if (angle < 280) return 'LAST QUARTER'
  return 'WANING CRESCENT'
}

const ZONES: Record<string, [number, number, string]> = {
  'Europe/London': [55.95, -3.19, 'UK'],
  'Europe/Dublin': [53.35, -6.26, 'Ireland'],
  'Europe/Paris': [48.86, 2.35, 'Paris'],
  'Europe/Berlin': [52.52, 13.4, 'Berlin'],
  'Europe/Madrid': [40.42, -3.7, 'Madrid'],
  'Europe/Amsterdam': [52.37, 4.9, 'Amsterdam'],
  'Europe/Stockholm': [59.33, 18.07, 'Stockholm'],
  'Europe/Rome': [41.9, 12.5, 'Rome'],
  'America/New_York': [40.71, -74.0, 'New York'],
  'America/Toronto': [43.65, -79.38, 'Toronto'],
  'America/Chicago': [41.88, -87.63, 'Chicago'],
  'America/Denver': [39.74, -104.99, 'Denver'],
  'America/Los_Angeles': [34.05, -118.24, 'Los Angeles'],
  'America/Sao_Paulo': [-23.55, -46.63, 'São Paulo'],
  'Asia/Tokyo': [35.68, 139.69, 'Tokyo'],
  'Asia/Singapore': [1.35, 103.82, 'Singapore'],
  'Asia/Kolkata': [28.61, 77.21, 'Delhi'],
  'Asia/Dubai': [25.2, 55.27, 'Dubai'],
  'Australia/Sydney': [-33.87, 151.21, 'Sydney'],
  'Australia/Melbourne': [-37.81, 144.96, 'Melbourne'],
  'Pacific/Auckland': [-36.85, 174.76, 'Auckland'],
}

const REGION_LAT: Record<string, number> = {
  Europe: 50,
  America: 38,
  Asia: 30,
  Africa: 5,
  Australia: -30,
  Pacific: -15,
  Atlantic: 40,
  Indian: -10,
}

/**
 * Best guess at the visitor's location without asking permission.
 * (Production can upgrade this with Cloudflare's request geo data.)
 */
export function guessLocation(): Location {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  const known = ZONES[tz]
  if (known) return { lat: known[0], lon: known[1], label: known[2], source: 'timezone' }
  const jan = new Date(new Date().getFullYear(), 0, 1).getTimezoneOffset()
  const jul = new Date(new Date().getFullYear(), 6, 1).getTimezoneOffset()
  const standardOffset = Math.max(jan, jul)
  const region = tz.split('/')[0]
  return {
    lat: REGION_LAT[region] ?? 45,
    lon: (-standardOffset / 60) * 15,
    label: tz.split('/').pop()?.replace(/_/g, ' ') ?? tz,
    source: 'offset',
  }
}
