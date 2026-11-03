import * as THREE from 'three'
import { LANDMARKS, PLANET_RADIUS, SEA_LEVEL, surfaceRadius } from './planet'

const UP = new THREE.Vector3(0, 1, 0)

/**
 * Home spot: out in front of the chapel, on the grass beside the wedding arch
 * and the benches, so nothing hides him. Offset is in the chapel's own frame
 * (x right, z towards the front).
 */
const HOME_OFFSET = new THREE.Vector3(-1.35, 0, 2.3)

function homeQuaternion() {
  const chapel = LANDMARKS.find((l) => l.id === 'chapel')
  if (!chapel) return new THREE.Quaternion()
  const frame = new THREE.Quaternion().setFromUnitVectors(UP, chapel.dir)
  frame.multiply(new THREE.Quaternion().setFromAxisAngle(UP, chapel.yaw))
  const dir = HOME_OFFSET.clone().applyQuaternion(frame).add(chapel.dir.clone().multiplyScalar(PLANET_RADIUS)).normalize()
  const q = new THREE.Quaternion().setFromUnitVectors(UP, dir)
  // Face out the same way as the chapel, turned slightly towards the arch.
  return q.multiply(new THREE.Quaternion().setFromAxisAngle(UP, chapel.yaw + 0.35))
}

/**
 * Where the avatar stands, as one planet-local orientation: local +Y is the
 * surface normal under his feet, local +Z is the way he faces.
 */
export const avatarState = {
  quaternion: homeQuaternion(),
  moving: false,
}

const frame = { position: new THREE.Vector3(), quaternion: new THREE.Quaternion(), dir: new THREE.Vector3() }

/** Current planet-local transform (shared object; copy if you need to keep it). */
export function avatarFrame() {
  frame.quaternion.copy(avatarState.quaternion)
  frame.dir.copy(UP).applyQuaternion(frame.quaternion)
  frame.position.copy(frame.dir).multiplyScalar(surfaceRadius(frame.dir))
  return frame
}

export function resetAvatar() {
  avatarState.quaternion.copy(homeQuaternion())
}

const scratchAxis = new THREE.Vector3()
const scratchDir = new THREE.Vector3()
const scratchFwd = new THREE.Vector3()
const step = new THREE.Quaternion()
const turnQ = new THREE.Quaternion()

/** Footprints (fraction of each pad) that are solid building. */
const SOLID = 0.6

export function isWalkable(dir: THREE.Vector3) {
  if (surfaceRadius(dir) < SEA_LEVEL + 0.03) return false
  for (const lm of LANDMARKS) if (dir.angleTo(lm.dir) < lm.pad * SOLID) return false
  return true
}

/**
 * Walk `distance` world units along the facing direction (negative = back)
 * and turn by `turn` radians. Returns whether he actually moved.
 */
export function moveAvatar(distance: number, turn: number) {
  const q = avatarState.quaternion
  if (turn !== 0) q.multiply(turnQ.setFromAxisAngle(UP, turn))
  if (distance === 0) return false
  const dir = scratchDir.copy(UP).applyQuaternion(q)
  const fwd = scratchFwd.set(0, 0, 1).applyQuaternion(q)
  scratchAxis.crossVectors(dir, fwd).normalize()
  step.setFromAxisAngle(scratchAxis, distance / PLANET_RADIUS)
  const next = dir.clone().applyQuaternion(step)
  if (!isWalkable(next)) return false
  q.premultiply(step).normalize()
  return true
}

/** The landmark he's standing at the door of, if any. */
export function nearbyLandmark() {
  const dir = scratchDir.copy(UP).applyQuaternion(avatarState.quaternion)
  let best: (typeof LANDMARKS)[number] | null = null
  let bestGap = Infinity
  for (const lm of LANDMARKS) {
    const gap = dir.angleTo(lm.dir) - lm.pad * SOLID
    if (gap < 0.12 && gap < bestGap) {
      best = lm
      bestGap = gap
    }
  }
  return best
}
