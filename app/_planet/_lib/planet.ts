import * as THREE from 'three'
import { fbm3, lerp, smoothstep } from './noise'

export const PLANET_RADIUS = 10
export const SEA_LEVEL = PLANET_RADIUS
const PLATEAU = PLANET_RADIUS + 0.45
const PATH_HEIGHT = PLANET_RADIUS + 0.24

export type LandmarkId = 'chapel' | 'workshop' | 'arcade' | 'farmhouse' | 'highstreet' | 'stadium' | 'postoffice' | 'gloaming'

export type Landmark = {
  id: LandmarkId
  title: string
  project: string
  blurb: string
  dir: THREE.Vector3
  /** Angular radius (radians) of the flattened build pad. */
  pad: number
  /** Yaw of the building around its local up axis. */
  yaw: number
}

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).normalize()

export const LANDMARKS: readonly Landmark[] = [
  {
    id: 'chapel',
    title: 'The Chapel',
    project: 'Knotless',
    blurb: 'Booking, proposals & CRM for wedding pros',
    dir: v(0, 1, 0.3),
    pad: 0.22,
    yaw: 0.35,
  },
  {
    id: 'workshop',
    title: 'The Workshop',
    project: 'Macbelt',
    blurb: 'macOS menu-bar toolkit',
    dir: v(0.95, 0.35, 0.3),
    pad: 0.18,
    yaw: -1.2,
  },
  {
    id: 'arcade',
    title: 'The Arcade',
    project: 'Name Game',
    blurb: 'Real-time multiplayer party game',
    dir: v(-0.9, 0.3, 0.45),
    pad: 0.18,
    yaw: 1.1,
  },
  {
    id: 'farmhouse',
    title: 'The Farmhouse',
    project: 'Dish',
    blurb: 'Recipes, meal plans & shopping lists',
    dir: v(0.15, -0.05, 1),
    pad: 0.18,
    yaw: 0.1,
  },
  {
    id: 'highstreet',
    title: 'High Street',
    project: 'Client work',
    blurb: 'Sites for hospitality, beauty & events',
    dir: v(0.1, 0.35, -1),
    pad: 0.27,
    yaw: Math.PI,
  },
  {
    id: 'stadium',
    title: 'The Stadium',
    project: 'FanDuel',
    blurb: 'Day job: front-end & mobile on Sportsbook',
    dir: v(0.55, -0.65, -0.5),
    pad: 0.27,
    yaw: 2.3,
  },
  {
    id: 'postoffice',
    title: 'The Post Office',
    project: 'Say hello',
    blurb: 'Send Callum a letter about a project',
    dir: v(-0.7, 0.6, -0.4),
    pad: 0.17,
    yaw: 0,
  },
  {
    id: 'gloaming',
    title: 'The Hill',
    project: 'Gloaming',
    blurb: 'A mood tracker you walk like a hill',
    dir: v(-0.59, -0.5, -0.63),
    pad: 0.2,
    yaw: 0,
  },
]

const byId = (id: LandmarkId): THREE.Vector3 => {
  const lm = LANDMARKS.find((l) => l.id === id)
  if (!lm) throw new Error(`Unknown landmark ${id}`)
  return lm.dir
}

export const PATHS: ReadonlyArray<readonly [THREE.Vector3, THREE.Vector3]> = [
  [byId('chapel'), byId('workshop')],
  [byId('chapel'), byId('arcade')],
  [byId('chapel'), byId('highstreet')],
  [byId('farmhouse'), byId('workshop')],
  [byId('farmhouse'), byId('arcade')],
  [byId('farmhouse'), byId('stadium')],
  [byId('highstreet'), byId('stadium')],
  [byId('postoffice'), byId('chapel')],
  [byId('postoffice'), byId('arcade')],
  [byId('gloaming'), byId('postoffice')],
  [byId('gloaming'), byId('stadium')],
]

const scratchN = new THREE.Vector3()
const scratchA = new THREE.Vector3()

/** Angular distance from dir to the great-circle arc a→b (Infinity if outside the arc's span). */
export function arcDistance(dir: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3): number {
  scratchN.crossVectors(a, b).normalize()
  const side = Math.asin(Math.min(1, Math.abs(dir.dot(scratchN))))
  const withinA = scratchA.crossVectors(a, dir).dot(scratchN) > 0
  const withinB = scratchA.crossVectors(dir, b).dot(scratchN) > 0
  if (!withinA || !withinB) return Infinity
  return side
}

export function pathDistance(dir: THREE.Vector3): number {
  let best = Infinity
  for (const [a, b] of PATHS) best = Math.min(best, arcDistance(dir, a, b))
  return best
}

/** Distance (radians) to the nearest landmark pad edge; negative when inside a pad. */
export function padDistance(dir: THREE.Vector3): number {
  let best = Infinity
  for (const lm of LANDMARKS) best = Math.min(best, dir.angleTo(lm.dir) - lm.pad)
  return best
}

export function rawHeight(dir: THREE.Vector3): number {
  const n = fbm3(dir.x * 1.7 + 3.1, dir.y * 1.7 + 0.4, dir.z * 1.7 - 1.7, 5)
  const ridge = fbm3(dir.x * 4.1 - 7, dir.y * 4.1 + 2, dir.z * 4.1, 3)
  return PLANET_RADIUS + 0.12 + n * 1.7 + Math.max(0, ridge) * 0.45
}

/** Final surface radius in a given direction (unit vector). */
export function surfaceRadius(dir: THREE.Vector3): number {
  let h = rawHeight(dir)

  const p = pathDistance(dir)
  const pathT = 1 - smoothstep(0.035, 0.11, p)
  h = lerp(h, PATH_HEIGHT, pathT * 0.85)

  for (const lm of LANDMARKS) {
    const t = 1 - smoothstep(lm.pad, lm.pad * 1.7, dir.angleTo(lm.dir))
    h = lerp(h, PLATEAU, t)
  }
  return h
}

const UP = new THREE.Vector3(0, 1, 0)

/** Transform that stands an object on the surface at `dir`, rotated `yaw` about the local up. */
export function surfaceFrame(dir: THREE.Vector3, yaw = 0, lift = 0) {
  const d = dir.clone().normalize()
  const position = d.clone().multiplyScalar(surfaceRadius(d) + lift)
  const quaternion = new THREE.Quaternion().setFromUnitVectors(UP, d)
  quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(UP, yaw))
  return { position, quaternion }
}

/** Point along the arc a→b at parameter t, offset sideways by `side` radians. */
export function pointOnArc(a: THREE.Vector3, b: THREE.Vector3, t: number, side = 0): THREE.Vector3 {
  const angle = a.angleTo(b)
  const axis = new THREE.Vector3().crossVectors(a, b).normalize()
  const p = a.clone().applyAxisAngle(axis, angle * t)
  if (side !== 0) {
    const tangent = new THREE.Vector3().crossVectors(axis, p).normalize()
    const sideAxis = tangent
    p.applyAxisAngle(sideAxis, side)
  }
  return p.normalize()
}
