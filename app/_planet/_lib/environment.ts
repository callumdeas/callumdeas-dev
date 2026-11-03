import * as THREE from 'three'
import { smoothstep } from './noise'
import { season, updateSeason } from './seasons'
import { weather } from './weather'
import { computeSky, guessLocation, type Location, type SkyState } from './sky'

/**
 * The whole look is a function of the sun's elevation (degrees), not the clock,
 * so seasons and latitude come for free. Each stop is a full lighting rig;
 * everything between stops is blended continuously.
 */
type Stop = {
  elevation: number
  skyTop: string
  skyMid: string
  skyBottom: string
  glow: string
  fog: string
  hemiSky: string
  hemiGround: string
  hemi: number
  sunColor: string
  sun: number
  cloud: string
  ocean: string
}

const STOPS: readonly Stop[] = [
  {
    // Deep night
    elevation: -18,
    skyTop: '#03050c',
    skyMid: '#0b1730',
    skyBottom: '#1a2f4a',
    glow: '#1a2440',
    fog: '#14233a',
    hemiSky: '#5f80b0',
    hemiGround: '#0a1020',
    hemi: 1.25,
    sunColor: '#ff7a40',
    sun: 0,
    cloud: '#3c4c6c',
    ocean: '#0f2a46',
  },
  {
    // Blue hour
    elevation: -8,
    skyTop: '#0c1132',
    skyMid: '#2b2d66',
    skyBottom: '#6c5690',
    glow: '#a05a8a',
    fog: '#363566',
    hemiSky: '#8c88cc',
    hemiGround: '#171330',
    hemi: 1.15,
    sunColor: '#ff6a40',
    sun: 0,
    cloud: '#6c6aa0',
    ocean: '#25285e',
  },
  {
    // Civil twilight: the violet dusk from round 1
    elevation: -2,
    skyTop: '#24163f',
    skyMid: '#7a3f78',
    skyBottom: '#f39a66',
    glow: '#ff8a5a',
    fog: '#6d4c7c',
    hemiSky: '#c49ae0',
    hemiGround: '#3a2142',
    hemi: 1.45,
    sunColor: '#ff8a50',
    sun: 0.6,
    cloud: '#f0b8d4',
    ocean: '#41438f',
  },
  {
    // Golden hour
    elevation: 4,
    skyTop: '#3b3c7e',
    skyMid: '#c36c80',
    skyBottom: '#ffbe7a',
    glow: '#ffb070',
    fog: '#a9768a',
    hemiSky: '#ffc6b8',
    hemiGround: '#4a2a42',
    hemi: 1.65,
    sunColor: '#ffae68',
    sun: 2.3,
    cloud: '#ffd0c4',
    ocean: '#545a9e',
  },
  {
    // Soft low sun
    elevation: 14,
    skyTop: '#4f6fb8',
    skyMid: '#b4a4cc',
    skyBottom: '#f2cfb4',
    glow: '#ffd8a8',
    fog: '#b9a3bf',
    hemiSky: '#ffe6e4',
    hemiGround: '#574860',
    hemi: 1.9,
    sunColor: '#ffdcae',
    sun: 2.5,
    cloud: '#fff0ea',
    ocean: '#5f7cb8',
  },
  {
    // Dreamy, hazy midday: lilac-blue haze rather than flat blue
    elevation: 40,
    skyTop: '#4472bb',
    skyMid: '#9fb5de',
    skyBottom: '#e3d6e6',
    glow: '#fff4dc',
    fog: '#adb6d6',
    hemiSky: '#eef0ff',
    hemiGround: '#5a6276',
    hemi: 2.1,
    sunColor: '#fff2dc',
    sun: 2.7,
    cloud: '#ffffff',
    ocean: '#5c8ccc',
  },
]

/** Sunrise reads a touch rosier and cooler than sunset. */
const MORNING_TINT = new THREE.Color('#ffd6ea')
const MORNING_KEYS: readonly ColorKey[] = ['skyMid', 'skyBottom', 'glow', 'fog', 'cloud']

type ColorKey = 'skyTop' | 'skyMid' | 'skyBottom' | 'glow' | 'fog' | 'hemiSky' | 'hemiGround' | 'sunColor' | 'cloud' | 'ocean'
const COLOR_KEYS: readonly ColorKey[] = ['skyTop', 'skyMid', 'skyBottom', 'glow', 'fog', 'hemiSky', 'hemiGround', 'sunColor', 'cloud', 'ocean']

const stopColors = STOPS.map((s) => {
  const out: Record<ColorKey, THREE.Color> = {
    skyTop: new THREE.Color(s.skyTop),
    skyMid: new THREE.Color(s.skyMid),
    skyBottom: new THREE.Color(s.skyBottom),
    glow: new THREE.Color(s.glow),
    fog: new THREE.Color(s.fog),
    hemiSky: new THREE.Color(s.hemiSky),
    hemiGround: new THREE.Color(s.hemiGround),
    sunColor: new THREE.Color(s.sunColor),
    cloud: new THREE.Color(s.cloud),
    ocean: new THREE.Color(s.ocean),
  }
  return out
})

const newColors = (): Record<ColorKey, THREE.Color> => ({
  skyTop: new THREE.Color(),
  skyMid: new THREE.Color(),
  skyBottom: new THREE.Color(),
  glow: new THREE.Color(),
  fog: new THREE.Color(),
  hemiSky: new THREE.Color(),
  hemiGround: new THREE.Color(),
  sunColor: new THREE.Color(),
  cloud: new THREE.Color(),
  ocean: new THREE.Color(),
})

export type Environment = {
  time: number
  location: Location
  sky: SkyState
  colors: Record<ColorKey, THREE.Color>
  hemi: number
  sunIntensity: number
  moonIntensity: number
  moonColor: THREE.Color
  /** Directions in the camera-relative sky frame (x right, y up, -z ahead). */
  sunDir: THREE.Vector3
  moonDir: THREE.Vector3
  /** 0 by day → 1 at night; drives lamps, windows, fireflies. */
  night: number
  stars: number
  /** 0..1 snow lying on the ground (festive dusting or real snowfall). */
  snow: number
  /** Brief extra fill light from firework bursts (and, later, lightning). Decays each frame. */
  flash: number
  flashColor: THREE.Color
  /** Scene fog distances; weather pulls them in. */
  fogNear: number
  fogFar: number
}

export const env: Environment = {
  time: 0,
  location: { lat: 55.95, lon: -3.19, label: 'UK', source: 'timezone' },
  sky: {
    sun: { elevation: 0, azimuth: 180 },
    moon: { elevation: 0, azimuth: 0, phaseAngle: 0, illumination: 0 },
    rising: false,
  },
  colors: newColors(),
  hemi: 1,
  sunIntensity: 0,
  moonIntensity: 0,
  moonColor: new THREE.Color('#a9c6ff'),
  sunDir: new THREE.Vector3(0, 1, -1),
  moonDir: new THREE.Vector3(0, 1, -1),
  night: 0,
  stars: 0,
  snow: 0,
  flash: 0,
  flashColor: new THREE.Color('#ffffff'),
  fogNear: 26,
  fogFar: 62,
}

/**
 * Map azimuth/elevation onto the visible sky: due south sits behind the
 * planet, east rises on the left, west sets on the right.
 */
function skyFrame(azimuth: number, elevation: number, out: THREE.Vector3) {
  // Squash azimuth so sunrise/sunset land inside the frame instead of off to the sides.
  const rel = ((azimuth - 180 + 540) % 360) - 180
  const a = rel * 0.42 * (Math.PI / 180)
  const e = elevation * (Math.PI / 180)
  return out.set(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e))
}

export function updateEnvironment(time: number) {
  env.time = time
  env.sky = computeSky(time, env.location)
  updateSeason(time, env.location.lat)
  env.snow = Math.max(season.festiveSnow, weather.lying)
  const el = env.sky.sun.elevation

  const last = STOPS.length - 1
  let i = 0
  while (i < last - 1 && el > STOPS[i + 1].elevation) i++
  const a = STOPS[i]
  const b = STOPS[Math.min(i + 1, last)]
  const t = smoothstep(a.elevation, b.elevation, el)
  for (const key of COLOR_KEYS) env.colors[key].lerpColors(stopColors[i][key], stopColors[Math.min(i + 1, last)][key], t)
  env.hemi = a.hemi + (b.hemi - a.hemi) * t
  env.sunIntensity = a.sun + (b.sun - a.sun) * t

  // Mornings: nudge the twilight band rosier.
  if (env.sky.rising) {
    const m = (1 - smoothstep(4, 14, Math.abs(el + 2))) * 0.35
    for (const key of MORNING_KEYS) env.colors[key].lerp(MORNING_TINT, m * 0.5)
  }

  skyFrame(env.sky.sun.azimuth, el, env.sunDir)
  skyFrame(env.sky.moon.azimuth, env.sky.moon.elevation, env.moonDir)

  env.night = smoothstep(3, -5, el)
  env.stars = smoothstep(-5, -13, el)
  env.moonIntensity =
    smoothstep(-2, 8, env.sky.moon.elevation) * (0.25 + 0.95 * env.sky.moon.illumination) * smoothstep(2, -6, el)

  applyWeather()
}

const GREY_KEYS: readonly ColorKey[] = ['skyTop', 'skyMid', 'skyBottom', 'glow', 'fog', 'hemiSky', 'cloud', 'ocean']
const grey = new THREE.Color()

/** Cloud and rain flatten the light: greyer, dimmer, the sun hidden, fog closer. */
function applyWeather() {
  const w = weather.now
  const oc = w.overcast
  if (oc > 0.001) {
    for (const key of GREY_KEYS) {
      const c = env.colors[key]
      const l = c.r * 0.299 + c.g * 0.587 + c.b * 0.114
      c.lerp(grey.setRGB(l, l, l), oc * 0.65)
    }
    env.colors.cloud.multiplyScalar(1 - 0.35 * oc)
    env.colors.skyTop.multiplyScalar(1 - 0.2 * oc)
    env.hemi *= 1 - 0.18 * oc
    env.sunIntensity *= 1 - 0.8 * smoothstep(0.1, 0.9, oc)
    env.moonIntensity *= 1 - 0.7 * oc
    env.stars *= 1 - smoothstep(0.15, 0.6, oc)
  }
  // Storms go properly dark.
  if (w.storm > 0.001) {
    for (const key of GREY_KEYS) env.colors[key].multiplyScalar(1 - 0.4 * w.storm)
    env.hemi *= 1 - 0.3 * w.storm
  }
  // Snow brightens everything a touch (light bouncing off the ground).
  env.hemi *= 1 + env.snow * 0.12
  // Fog closes in, but the planet (about 36 units away) must stay readable.
  env.fogNear = 26 - 14 * w.fog
  env.fogFar = 62 - 18 * w.fog
}

/** Night factor for one light with its own switch-on offset (degrees). */
export function lightsOn(stagger: number) {
  return smoothstep(3 + stagger, -3 + stagger, env.sky.sun.elevation)
}

// ---------------------------------------------------------------------------
// Simulated clock: real time by default, scrubbable/fast-forwardable for review.

export const clock = {
  speed: 1,
  anchorSim: 0,
  anchorReal: 0,
  live: true,
}

export function initEnvironment() {
  env.location = guessLocation()
  goLive()
  updateEnvironment(simNow())
}

export function simNow() {
  return clock.anchorSim + (Date.now() - clock.anchorReal) * clock.speed
}

function reanchor(sim: number) {
  clock.anchorSim = sim
  clock.anchorReal = Date.now()
}

export function setSpeed(speed: number) {
  reanchor(simNow())
  clock.speed = speed
  clock.live = false
}

export function setSimTime(ms: number) {
  reanchor(ms)
  clock.live = false
}

export function goLive() {
  reanchor(Date.now())
  clock.speed = 1
  clock.live = true
}
