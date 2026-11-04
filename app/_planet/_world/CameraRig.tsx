'use client'

import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef, type ReactNode } from 'react'
import * as THREE from 'three'
import { avatarFrame } from '../_lib/avatarState'
import { LANDMARKS, surfaceFrame, type LandmarkId } from '../_lib/planet'
import type { Selection } from '../_lib/selection'
import { useInteraction } from './interaction'

/**
 * The camera never orbits. Instead the planet (the world group) spins in
 * front of it, with no poles to get stuck on, and a selected place is
 * "presented" by spinning it to the top (+Y) facing the camera (+Z).
 */
type Shot = {
  world: THREE.Quaternion
  target: THREE.Vector3
  cam: THREE.Vector3
  min: number
  max: number
  /** orbit: free spin on both axes; place: yaw around the subject only. */
  drag: 'free' | 'yaw' | 'none'
}

export type RigMode = 'orbit' | 'explore'

const ORBIT_CAM = new THREE.Vector3(0.24, 0.34, 1).normalize().multiplyScalar(40)
const FLIGHT_SECONDS = 2.1
const AUTO_SPIN = 0.06 // rad/s
const DRAG_SPEED = 0.0055 // rad per pixel at default zoom

/** Shared flags other components read (explore controller, HUD). */
export const rigState = { flying: false }

function setFlying(v: boolean) {
  rigState.flying = v
}

function setCanvasStyle(el: HTMLElement, cursor: string) {
  el.style.touchAction = 'none'
  el.style.cursor = cursor
}

const DISTANCE: Record<LandmarkId, number> = {
  chapel: 10.5,
  workshop: 8,
  arcade: 8,
  farmhouse: 8,
  highstreet: 10.5,
  stadium: 11,
  postoffice: 8,
}
const LOOK_HEIGHT: Record<LandmarkId, number> = {
  chapel: 1.7,
  workshop: 0.9,
  arcade: 1.0,
  farmhouse: 0.8,
  highstreet: 0.8,
  stadium: 0.6,
  postoffice: 0.9,
}

function presentedShot(
  position: THREE.Vector3,
  frame: THREE.Quaternion,
  lookHeight: number,
  distance: number,
  panelShift: { x: number; y: number },
): Shot {
  const world = frame.clone().invert()
  const height = position.length() + lookHeight
  const sx = distance * panelShift.x
  const sy = distance * panelShift.y
  return {
    world,
    target: new THREE.Vector3(sx, height + sy, 0),
    cam: new THREE.Vector3(sx, height + sy + distance * 0.42, distance),
    min: distance * 0.45,
    max: distance * 2,
    drag: 'yaw',
  }
}

const FACE_AWAY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI)

/** Third-person: avatar on top facing away from the camera, planet curving off ahead. */
export function exploreWorld(out: THREE.Quaternion) {
  return out.copy(avatarFrame().quaternion).multiply(FACE_AWAY).invert()
}

function exploreShot(): Shot {
  const r = avatarFrame().position.length()
  return {
    world: exploreWorld(new THREE.Quaternion()),
    target: new THREE.Vector3(0, r + 0.2, -2.6),
    cam: new THREE.Vector3(0, r + 4.6, 7.4),
    min: 3,
    max: 14,
    drag: 'none',
  }
}

function shotFor(sel: Selection, mode: RigMode, currentWorld: THREE.Quaternion, panelShift: { x: number; y: number }): Shot {
  if (sel === null) {
    if (mode === 'explore') return exploreShot()
    return { world: currentWorld.clone(), target: new THREE.Vector3(), cam: ORBIT_CAM.clone(), min: 16, max: 60, drag: 'free' }
  }
  if (sel.kind === 'avatar') {
    const f = avatarFrame()
    return presentedShot(f.position, f.quaternion, 0.4, 3.0, panelShift)
  }
  const lm = LANDMARKS.find((l) => l.id === sel.id)
  if (!lm) return shotFor(null, mode, currentWorld, panelShift)
  const frame = surfaceFrame(lm.dir, lm.yaw)
  return presentedShot(frame.position, frame.quaternion, LOOK_HEIGHT[lm.id], DISTANCE[lm.id], panelShift)
}

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)

type Flight = {
  t: number
  fromTarget: THREE.Vector3
  fromCam: THREE.Vector3
  fromWorld: THREE.Quaternion
  to: Shot
  arc: THREE.Quaternion
  lift: number
}

/** Mutable camera/drag state, kept outside React. */
type View = {
  target: THREE.Vector3
  cam: THREE.Vector3
  zoom: number
  shot: Shot
  dragging: boolean
  pointers: Map<number, { x: number; y: number }>
  pinch: number
  velocity: THREE.Vector2
  lastMove: number
}

const scratchQ = new THREE.Quaternion()
const scratchQ2 = new THREE.Quaternion()
const axis = new THREE.Vector3()
const Y = new THREE.Vector3(0, 1, 0)

function placeCamera(camera: THREE.Camera, target: THREE.Vector3, cam: THREE.Vector3, zoom: number) {
  camera.position.copy(cam).sub(target).multiplyScalar(zoom).add(target)
  camera.up.set(0, 1, 0)
  camera.lookAt(target)
}

function stepFlight(f: Flight, view: View, camera: THREE.Camera, world: THREE.Group, dt: number) {
  f.t = Math.min(1, f.t + dt / FLIGHT_SECONDS)
  const e = easeInOutCubic(f.t)
  world.quaternion.slerpQuaternions(f.fromWorld, f.to.world, e)
  view.target.lerpVectors(f.fromTarget, f.to.target, e)
  scratchQ.identity().slerp(f.arc, e)
  const r = THREE.MathUtils.lerp(f.fromCam.length(), f.to.cam.length(), e) + Math.sin(Math.PI * e) * f.lift
  view.cam.copy(f.fromCam).normalize().applyQuaternion(scratchQ).multiplyScalar(r)
  view.zoom = THREE.MathUtils.lerp(view.zoom, 1, e)
  placeCamera(camera, view.target, view.cam, 1)
}

/** Rotate the world by a screen-space drag (dx, dy in pixels). */
function spinWorld(world: THREE.Group, camera: THREE.Camera, mode: Shot['drag'], dx: number, dy: number, zoom: number) {
  const k = DRAG_SPEED * Math.min(1.6, Math.max(0.5, zoom))
  if (mode === 'none') return
  if (mode === 'yaw') {
    scratchQ.setFromAxisAngle(Y, dx * k)
    world.quaternion.premultiply(scratchQ)
    return
  }
  axis.set(0, 1, 0).applyQuaternion(camera.quaternion)
  scratchQ.setFromAxisAngle(axis, dx * k)
  axis.set(1, 0, 0).applyQuaternion(camera.quaternion)
  scratchQ2.setFromAxisAngle(axis, dy * k)
  world.quaternion.premultiply(scratchQ).premultiply(scratchQ2)
}

function clampZoom(view: View) {
  const d = view.cam.distanceTo(view.target) || 1
  view.zoom = THREE.MathUtils.clamp(view.zoom, view.shot.min / d, view.shot.max / d)
}

export function CameraRig({
  selection,
  mode,
  panelShift,
  paused,
  reducedMotion,
  children,
}: {
  selection: Selection
  mode: RigMode
  panelShift: { x: number; y: number }
  /** Stop auto-spin (e.g. while something is hovered) so it's easy to click. */
  paused: boolean
  reducedMotion: boolean
  children: ReactNode
}) {
  const world = useRef<THREE.Group>(null)
  const flight = useRef<Flight | null>(null)
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)
  const { setHovered } = useInteraction()
  const clearHover = useRef(setHovered)
  useEffect(() => {
    clearHover.current = setHovered
  }, [setHovered])
  const view = useRef<View>({
    target: new THREE.Vector3(),
    cam: ORBIT_CAM.clone(),
    zoom: 1,
    shot: { world: new THREE.Quaternion(), target: new THREE.Vector3(), cam: ORBIT_CAM.clone(), min: 16, max: 60, drag: 'free' },
    dragging: false,
    pointers: new Map(),
    pinch: 0,
    velocity: new THREE.Vector2(),
    lastMove: 0,
  })

  // New destination → plan a flight from wherever we are now.
  useEffect(() => {
    const w = world.current
    if (!w) return
    const v = view.current
    const to = shotFor(selection, mode, w.quaternion, panelShift)
    v.shot = to
    v.velocity.set(0, 0)
    const fromCam = camera.position.clone()
    const arc = new THREE.Quaternion().setFromUnitVectors(fromCam.clone().normalize(), to.cam.clone().normalize())
    const turn = w.quaternion.angleTo(to.world) + fromCam.angleTo(to.cam)
    flight.current = {
      t: reducedMotion ? 1 : 0,
      fromTarget: v.target.clone(),
      fromCam,
      fromWorld: w.quaternion.clone(),
      to,
      arc,
      lift: Math.min(turn, Math.PI) * 4,
    }
    setFlying(true)
  }, [selection, mode, panelShift, camera, reducedMotion])

  // Pointer drag / wheel / pinch on the canvas.
  useEffect(() => {
    const el = gl.domElement
    const v = view.current
    setCanvasStyle(el, 'grab')

    const down = (e: PointerEvent) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return
      v.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (v.pointers.size === 2) {
        const [a, b] = [...v.pointers.values()]
        v.pinch = Math.hypot(a.x - b.x, a.y - b.y)
      }
      v.dragging = true
      v.velocity.set(0, 0)
      v.lastMove = performance.now()
      setCanvasStyle(el, 'grabbing')
    }
    const move = (e: PointerEvent) => {
      const prev = v.pointers.get(e.pointerId)
      if (!prev) return
      const dx = e.clientX - prev.x
      const dy = e.clientY - prev.y
      v.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      const w = world.current
      if (!w || flight.current) return
      if (v.pointers.size === 2) {
        const [a, b] = [...v.pointers.values()]
        const d = Math.hypot(a.x - b.x, a.y - b.y)
        if (v.pinch > 0) {
          v.zoom *= v.pinch / d
          clampZoom(v)
        }
        v.pinch = d
        return
      }
      if (Math.abs(dx) + Math.abs(dy) > 2) clearHover.current(null)
      spinWorld(w, camera, v.shot.drag, dx, dy, v.zoom)
      const now = performance.now()
      const dt = Math.max(1, now - v.lastMove) / 1000
      v.velocity.set(dx / dt, dy / dt).multiplyScalar(0.6).add(v.velocity.clone().multiplyScalar(0.4))
      v.lastMove = now
    }
    const up = (e: PointerEvent) => {
      v.pointers.delete(e.pointerId)
      if (v.pointers.size < 2) v.pinch = 0
      if (v.pointers.size === 0) {
        v.dragging = false
        setCanvasStyle(el, 'grab')
        // A pause before release means no fling.
        if (performance.now() - v.lastMove > 80) v.velocity.set(0, 0)
      }
    }
    const wheel = (e: WheelEvent) => {
      e.preventDefault()
      if (flight.current) return
      v.zoom *= Math.exp(e.deltaY * 0.0012)
      clampZoom(v)
    }
    el.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    el.addEventListener('wheel', wheel, { passive: false })
    return () => {
      el.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      el.removeEventListener('wheel', wheel)
    }
  }, [gl, camera])

  useFrame((_, dt) => {
    const w = world.current
    if (!w) return
    const v = view.current
    const f = flight.current
    if (f) {
      stepFlight(f, v, camera, w, dt)
      if (f.t >= 1) {
        flight.current = null
        setFlying(false)
        v.target.copy(f.to.target)
        v.cam.copy(f.to.cam)
        v.zoom = 1
      }
      return
    }

    if (v.shot.drag === 'none' && mode === 'explore' && selection === null) {
      // Follow the walking avatar: keep him on top, facing away.
      exploreWorld(scratchQ)
      w.quaternion.slerp(scratchQ, 1 - Math.exp(-dt * 12))
    } else if (!v.dragging) {
      // Fling momentum, then gentle auto-spin when idle.
      if (v.velocity.lengthSq() > 1) {
        spinWorld(w, camera, v.shot.drag, v.velocity.x * dt, v.velocity.y * dt, v.zoom)
        v.velocity.multiplyScalar(Math.exp(-dt * 3.5))
      } else if (selection === null && !paused && !reducedMotion) {
        scratchQ.setFromAxisAngle(Y, AUTO_SPIN * dt)
        w.quaternion.premultiply(scratchQ)
      }
    }
    placeCamera(camera, v.target, v.cam, v.zoom)
  })

  return <group ref={world}>{children}</group>
}

