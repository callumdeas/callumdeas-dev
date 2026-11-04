'use client'

import { useFrame } from '@react-three/fiber'
import { useMemo, useRef, type RefObject } from 'react'
import * as THREE from 'three'
import { getTextures } from '../_lib/assets'
import { env } from '../_lib/environment'
import { mulberry32, smoothstep } from '../_lib/noise'
import { LANDMARKS, PLANET_RADIUS, SEA_LEVEL, padDistance, pathDistance, surfaceFrame, surfaceRadius, type LandmarkId } from '../_lib/planet'
import { ps1Material } from '../_lib/ps1'
import { season, type Festival } from '../_lib/seasons'
import { sound } from '../_lib/sound'
import { Glow } from './Glow'

// ---------------------------------------------------------------------------- placement helpers

const UP = new THREE.Vector3(0, 1, 0)

/**
 * A clear patch of ground just outside a landmark's pad: off the paths, above
 * the sea, and inside the tree-free margin the scatter leaves around every pad.
 */
function openSpot(near: LandmarkId, turn: number): THREE.Vector3 {
  const lm = LANDMARKS.find((l) => l.id === near)
  if (!lm) throw new Error(`Unknown landmark ${near}`)
  const tangent = new THREE.Vector3().crossVectors(lm.dir, Math.abs(lm.dir.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : UP).normalize()
  const dir = new THREE.Vector3()
  for (let i = 0; i < 48; i++) {
    const az = turn + (i * Math.PI * 2) / 48
    for (const extra of [0.03, 0.045, 0.02]) {
      const axis = tangent.clone().applyAxisAngle(lm.dir, az)
      dir.copy(lm.dir).applyAxisAngle(axis, lm.pad + extra).normalize()
      const h = surfaceRadius(dir)
      const pd = padDistance(dir)
      if (pd > 0.012 && pd < 0.048 && pathDistance(dir) > 0.08 && h > SEA_LEVEL + 0.25 && h < PLANET_RADIUS + 1.2) return dir.clone()
    }
  }
  return lm.dir.clone()
}

/** A point given in a landmark's own frame (x right, z towards its front), dropped onto the ground. */
function frameSpot(near: LandmarkId, x: number, z: number): THREE.Vector3 {
  const lm = LANDMARKS.find((l) => l.id === near)
  if (!lm) throw new Error(`Unknown landmark ${near}`)
  const f = surfaceFrame(lm.dir, lm.yaw)
  return new THREE.Vector3(x, 0, z).applyQuaternion(f.quaternion).add(f.position).normalize()
}

/** Show a group only while its festival is on. */
function showFor(group: THREE.Group | null, festival: Festival | readonly Festival[]) {
  if (!group) return
  const on = season.festival !== null && (typeof festival === 'string' ? festival === season.festival : festival.includes(season.festival))
  group.visible = on
}

function useFestival(group: RefObject<THREE.Group | null>, festival: Festival | readonly Festival[]) {
  useFrame(() => showFor(group.current, festival))
}

// ---------------------------------------------------------------------------- fireworks

const MAX_SPARKS = 1600
const MAX_ROCKETS = 10
const GRAVITY = 1.1
const PALETTES: readonly (readonly string[])[] = [
  ['#ff5a5a', '#ffd36a'],
  ['#6af0ff', '#ffffff'],
  ['#ff7ad9', '#ffd1f0'],
  ['#9dff7a', '#fff6a0'],
  ['#ffb04a', '#ff6a2a'],
  ['#b28aff', '#6af0ff'],
]

type Rocket = { active: boolean; pos: THREE.Vector3; vel: THREE.Vector3; fuse: number; palette: number; ring: boolean }

type Sparks = {
  pos: Float32Array
  vel: Float32Array
  base: Float32Array
  life: Float32Array
  maxLife: Float32Array
  next: number
}

const tmpA = new THREE.Vector3()
const tmpB = new THREE.Vector3()
const tmpC = new THREE.Vector3()
const tmpColor = new THREE.Color()

function spawnSpark(s: Sparks, p: THREE.Vector3, v: THREE.Vector3, color: THREE.Color, life: number) {
  const i = s.next
  s.next = (s.next + 1) % MAX_SPARKS
  s.pos.set([p.x, p.y, p.z], i * 3)
  s.vel.set([v.x, v.y, v.z], i * 3)
  s.base.set([color.r, color.g, color.b], i * 3)
  s.life[i] = life
  s.maxLife[i] = life
}

function burst(s: Sparks, r: Rocket, rand: () => number) {
  const palette = PALETTES[r.palette]
  const count = 70 + Math.floor(rand() * 50)
  const speed = 1.5 + rand() * 0.9
  const up = tmpC.copy(r.pos).normalize()
  const tilt = new THREE.Quaternion().setFromUnitVectors(UP, up)
  for (let k = 0; k < count; k++) {
    if (r.ring) {
      // A flat ring, tilted to face roughly outwards from the planet.
      const a = (k / count) * Math.PI * 2
      tmpA.set(Math.cos(a), 0, Math.sin(a)).applyQuaternion(tilt)
    } else {
      tmpA.set(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1).normalize()
    }
    tmpA.multiplyScalar(speed * (r.ring ? 1 : 0.6 + rand() * 0.4)).addScaledVector(r.vel, 0.15)
    tmpColor.set(palette[k % palette.length])
    spawnSpark(s, r.pos, tmpA, tmpColor, 1.3 + rand() * 0.9)
  }
}

function launch(r: Rocket, group: THREE.Object3D, camera: THREE.Camera, rand: () => number) {
  // Pick a launch spot on land, on the side of the planet the camera can see.
  const camDir = group.worldToLocal(tmpB.copy(camera.position)).normalize()
  const dir = tmpA
  for (let i = 0; i < 30; i++) {
    dir.set(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1).normalize()
    if (dir.dot(camDir) > 0.45 && surfaceRadius(dir) > SEA_LEVEL + 0.1) break
  }
  r.active = true
  r.pos.copy(dir).multiplyScalar(surfaceRadius(dir))
  tmpC.set(rand() - 0.5, rand() - 0.5, rand() - 0.5).multiplyScalar(0.8)
  r.vel.copy(dir).multiplyScalar(5.2 + rand() * 1.4).add(tmpC)
  r.fuse = 0.85 + rand() * 0.45
  r.palette = Math.floor(rand() * PALETTES.length)
  r.ring = rand() < 0.25
}

/** Advance live sparks: radial gravity towards the planet, drag, and fade by writing dimmer colours. */
function stepSparks(s: Sparks, geo: THREE.BufferGeometry, dt: number) {
  const pos = geo.getAttribute('position')
  const col = geo.getAttribute('color')
  const drag = Math.pow(0.35, dt)
  for (let i = 0; i < MAX_SPARKS; i++) {
    if (s.life[i] <= 0) continue
    s.life[i] -= dt
    const o = i * 3
    if (s.life[i] <= 0) {
      col.setXYZ(i, 0, 0, 0)
      continue
    }
    tmpA.set(s.pos[o], s.pos[o + 1], s.pos[o + 2])
    const g = tmpB.copy(tmpA).normalize().multiplyScalar(-GRAVITY * dt)
    s.vel[o] = s.vel[o] * drag + g.x
    s.vel[o + 1] = s.vel[o + 1] * drag + g.y
    s.vel[o + 2] = s.vel[o + 2] * drag + g.z
    s.pos[o] += s.vel[o] * dt
    s.pos[o + 1] += s.vel[o + 1] * dt
    s.pos[o + 2] += s.vel[o + 2] * dt
    const k = Math.max(0, s.life[i] / s.maxLife[i])
    // Twinkle out at the end, PS1-style.
    const fade = k < 0.3 ? k / 0.3 * (Math.random() > 0.3 ? 1 : 0.2) : 1
    col.setXYZ(i, s.base[o] * fade, s.base[o + 1] * fade, s.base[o + 2] * fade)
  }
  pos.array.set(s.pos)
  pos.needsUpdate = true
  col.needsUpdate = true
}

type FireworksState = { sparks: Sparks; rockets: Rocket[]; geo: THREE.BufferGeometry; wait: number }

function stepFireworks(state: FireworksState, g: THREE.Group, camera: THREE.Camera, dt: number, rand: () => number, reducedMotion: boolean) {
  const { sparks, rockets, geo } = state
  // Only after dark: the fireworks curve is the date, the night gate is the sky.
  const intensity = season.fireworks * smoothstep(0.35, 0.8, env.night)

  state.wait -= dt
  if (intensity > 0.01 && state.wait <= 0) {
    const free = rockets.find((r) => !r.active)
    if (free) launch(free, g, camera, rand)
    // Busy nights: up to ~3 a second; quiet ones: one every few seconds.
    state.wait = (0.3 + rand() * 0.7) / (intensity * 2.4)
  }

  for (const r of rockets) {
    if (!r.active) continue
    r.fuse -= dt
    tmpA.copy(r.pos).normalize().multiplyScalar(-GRAVITY * dt)
    r.vel.add(tmpA)
    r.pos.addScaledVector(r.vel, dt)
    // Trail: a dim spark left behind each frame.
    tmpColor.set('#ffd9a0').multiplyScalar(0.6)
    spawnSpark(sparks, r.pos, tmpB.copy(r.vel).multiplyScalar(-0.05), tmpColor, 0.35)
    if (r.fuse <= 0) {
      r.active = false
      burst(sparks, r, rand)
      const dist = g.localToWorld(tmpB.copy(r.pos)).distanceTo(camera.position)
      sound.firework(Math.min(1, 18 / dist), dist / 60)
      if (!reducedMotion) {
        env.flash = Math.min(0.9, env.flash + 0.45)
        env.flashColor.set(PALETTES[r.palette][0])
      }
    }
  }

  stepSparks(sparks, geo, dt)
  env.flash = Math.max(0, env.flash - dt * 2.5)
}

export function Fireworks({ reducedMotion }: { reducedMotion: boolean }) {
  const group = useRef<THREE.Group>(null)
  const rand = useMemo(() => mulberry32(1105), [])
  const state = useMemo((): FireworksState => {
    const sparks: Sparks = {
      pos: new Float32Array(MAX_SPARKS * 3),
      vel: new Float32Array(MAX_SPARKS * 3),
      base: new Float32Array(MAX_SPARKS * 3),
      life: new Float32Array(MAX_SPARKS),
      maxLife: new Float32Array(MAX_SPARKS).fill(1),
      next: 0,
    }
    const rockets: Rocket[] = Array.from({ length: MAX_ROCKETS }, () => ({
      active: false,
      pos: new THREE.Vector3(),
      vel: new THREE.Vector3(),
      fuse: 0,
      palette: 0,
      ring: false,
    }))
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_SPARKS * 3), 3))
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MAX_SPARKS * 3), 3))
    return { sparks, rockets, geo, wait: 0 }
  }, [])

  useFrame(({ camera }, rawDt) => {
    if (group.current) stepFireworks(state, group.current, camera, Math.min(rawDt, 0.05), rand, reducedMotion)
  })

  return (
    <group ref={group}>
      <points geometry={state.geo} frustumCulled={false} renderOrder={4}>
        <pointsMaterial
          map={getTextures().glow}
          vertexColors
          size={0.45}
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          fog={false}
        />
      </points>
    </group>
  )
}

// ---------------------------------------------------------------------------- bonfire night

function Flame({ material, phase, scale }: { material: THREE.Material; phase: number; scale: number }) {
  const ref = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    const m = ref.current
    if (!m) return
    const t = clock.elapsedTime * 9 + phase
    const f = 0.8 + Math.sin(t) * 0.12 + Math.sin(t * 2.3) * 0.08
    m.scale.set(scale * (1.1 - f * 0.2), scale * f * 1.3, scale * (1.1 - f * 0.2))
    m.rotation.y = t * 0.15
  })
  return (
    <mesh ref={ref} material={material} position={[0, 0.28, 0]}>
      <coneGeometry args={[0.22, 0.6, 5]} />
    </mesh>
  )
}

function Embers() {
  const ref = useRef<THREE.Points>(null)
  const { geo, seeds } = useMemo(() => {
    const n = 24
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3))
    const rand = mulberry32(55)
    return { geo: g, seeds: Array.from({ length: n }, () => rand()) }
  }, [])
  useFrame(({ clock }) => {
    const pos = geo.getAttribute('position')
    seeds.forEach((s, i) => {
      const k = (clock.elapsedTime * 0.45 + s) % 1
      pos.setXYZ(i, Math.sin(s * 40 + k * 6) * 0.15 * (1 + k), 0.3 + k * 2.2, Math.cos(s * 33 + k * 5) * 0.15 * (1 + k))
    })
    pos.needsUpdate = true
  })
  return (
    <points ref={ref} geometry={geo}>
      <pointsMaterial map={getTextures().glow} color="#ffb04a" size={0.14} transparent blending={THREE.AdditiveBlending} depthWrite={false} />
    </points>
  )
}

function Bonfire() {
  const group = useRef<THREE.Group>(null)
  useFestival(group, 'bonfire')
  const frame = useMemo(() => surfaceFrame(openSpot('farmhouse', 2.4), 0, -0.02), [])
  const m = useMemo(
    () => ({
      log: ps1Material({ color: '#4a3226' }),
      outer: ps1Material({ color: '#000000', emissive: '#ff6a1a', emissiveIntensity: 2.4, transparent: true, opacity: 0.85 }),
      inner: ps1Material({ color: '#000000', emissive: '#ffd36a', emissiveIntensity: 2.6 }),
    }),
    [],
  )
  const logs = useMemo(() => Array.from({ length: 7 }, (_, i) => (i / 7) * Math.PI * 2), [])
  return (
    <group ref={group} position={frame.position} quaternion={frame.quaternion} visible={false}>
      {logs.map((a) => (
        <mesh key={a} material={m.log} position={[Math.cos(a) * 0.12, 0.2, Math.sin(a) * 0.12]} rotation={[Math.sin(a) * 0.45, 0, -Math.cos(a) * 0.45]}>
          <cylinderGeometry args={[0.035, 0.045, 0.5, 4]} />
        </mesh>
      ))}
      <Flame material={m.outer} phase={0} scale={1} />
      <Flame material={m.inner} phase={2} scale={0.6} />
      <Embers />
      <Glow position={[0, 0.5, 0]} color="#ff8a3a" size={2.8} kind="always" opacity={0.7} />
    </group>
  )
}

// ---------------------------------------------------------------------------- christmas

/** The tree stays up through Hogmanay. */
const CHRISTMAS_TREE_UP: readonly Festival[] = ['christmas', 'newyear']

const BULBS = ['#ff4a4a', '#ffd36a', '#4ad0ff', '#7aff8a', '#ff7ad9']

function ChristmasTree() {
  const group = useRef<THREE.Group>(null)
  useFestival(group, CHRISTMAS_TREE_UP)
  const frame = useMemo(() => surfaceFrame(frameSpot('highstreet', 3.1, 0.7), 0, -0.02), [])
  const m = useMemo(
    () => ({
      needles: ps1Material({ color: '#2c5a44' }),
      trunk: ps1Material({ color: '#5a3f33' }),
      star: ps1Material({ color: '#000000', emissive: '#ffd36a', emissiveIntensity: 2.4 }),
    }),
    [],
  )
  const bulbs = useMemo(() => {
    const rand = mulberry32(25)
    return Array.from({ length: 14 }, (_, i) => {
      const y = 0.35 + rand() * 0.95
      const r = 0.42 * (1 - (y - 0.2) / 1.25) + 0.03
      const a = i * 2.4
      return { p: [Math.cos(a) * r, y, Math.sin(a) * r] satisfies [number, number, number], color: BULBS[i % BULBS.length], stagger: i }
    })
  }, [])
  const bulbGroup = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    // Chasing lights: each bulb blinks on its own beat.
    const t = Math.floor(clock.elapsedTime * 2)
    bulbGroup.current?.children.forEach((c, i) => {
      c.visible = (t + i) % 3 !== 0
    })
  })
  return (
    <group ref={group} position={frame.position} quaternion={frame.quaternion} scale={1.1} visible={false}>
      <mesh material={m.trunk} position={[0, 0.1, 0]}>
        <cylinderGeometry args={[0.05, 0.07, 0.2, 4]} />
      </mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={i} material={m.needles} position={[0, 0.45 + i * 0.32, 0]}>
          <coneGeometry args={[0.5 - i * 0.13, 0.55, 6]} />
        </mesh>
      ))}
      <mesh material={m.star} position={[0, 1.42, 0]} rotation={[0, 0, Math.PI / 4]}>
        <octahedronGeometry args={[0.09, 0]} />
      </mesh>
      <Glow position={[0, 1.42, 0]} color="#ffd36a" size={0.8} kind="neon" />
      <group ref={bulbGroup}>
        {bulbs.map((b, i) => (
          <Glow key={i} position={b.p} color={b.color} size={0.32} kind="neon" opacity={1} />
        ))}
      </group>
    </group>
  )
}

// ---------------------------------------------------------------------------- halloween

function Bats() {
  const group = useRef<THREE.Group>(null)
  useFestival(group, 'halloween')
  const chapel = useMemo(() => {
    const lm = LANDMARKS.find((l) => l.id === 'chapel')
    return lm ? surfaceFrame(lm.dir, lm.yaw) : surfaceFrame(UP)
  }, [])
  const mat = useMemo(() => ps1Material({ color: '#15121c', side: THREE.DoubleSide }), [])
  const wing = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0, 0.18, 0.04, -0.05, 0.16, 0, 0.06]), 3))
    g.computeVertexNormals()
    return g
  }, [])
  const flock = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    const f = flock.current
    if (!f) return
    const t = clock.elapsedTime
    f.visible = env.night > 0.4
    f.children.forEach((bat, i) => {
      const a = t * (0.6 + i * 0.07) + i * 1.7
      const r = 1.6 + (i % 3) * 0.5
      bat.position.set(Math.cos(a) * r, 3.4 + Math.sin(t * 1.3 + i) * 0.4 + (i % 2) * 0.6, Math.sin(a) * r)
      bat.rotation.y = -a
      const flap = Math.sin(t * 18 + i) * 0.7
      bat.children[0].rotation.z = flap
      bat.children[1].rotation.z = -flap
    })
  })
  return (
    <group ref={group} position={chapel.position} quaternion={chapel.quaternion} visible={false}>
      <group ref={flock}>
        {Array.from({ length: 6 }, (_, i) => (
          <group key={i}>
            <mesh geometry={wing} material={mat} />
            <mesh geometry={wing} material={mat} scale={[-1, 1, 1]} />
          </group>
        ))}
      </group>
    </group>
  )
}

// ---------------------------------------------------------------------------- birthday

const BALLOON_COLORS = ['#ff9d6c', '#ff5a7a', '#6ac8ff', '#ffd36a', '#9d7aff', '#7aff9d']
const BALLOON_SITES: readonly [LandmarkId, number][] = [
  ['chapel', 0.4],
  ['chapel', 3.4],
  ['workshop', 1.2],
  ['arcade', 2.1],
  ['farmhouse', 0.3],
  ['farmhouse', 4.2],
  ['highstreet', 2.6],
  ['stadium', 1.5],
  ['stadium', 4.6],
]

function Balloon({ dir, color, seed }: { dir: THREE.Vector3; color: string; seed: number }) {
  const frame = useMemo(() => surfaceFrame(dir, 0, -0.02), [dir])
  const m = useMemo(
    () => ({ skin: ps1Material({ color, emissive: color, emissiveIntensity: 0.25 }), string: ps1Material({ color: '#f2eee8' }) }),
    [color],
  )
  const bob = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    const b = bob.current
    if (!b) return
    const t = clock.elapsedTime + seed * 10
    b.rotation.z = Math.sin(t * 0.9) * 0.12
    b.rotation.x = Math.cos(t * 0.7) * 0.1
  })
  const height = 1.1 + (seed % 0.4)
  return (
    <group position={frame.position} quaternion={frame.quaternion}>
      <group ref={bob}>
        <mesh material={m.string} position={[0, height / 2, 0]}>
          <boxGeometry args={[0.01, height, 0.01]} />
        </mesh>
        <mesh material={m.skin} position={[0, height + 0.2, 0]} scale={[1, 1.2, 1]}>
          <icosahedronGeometry args={[0.2, 0]} />
        </mesh>
        <mesh material={m.skin} position={[0, height - 0.02, 0]}>
          <coneGeometry args={[0.035, 0.05, 4]} />
        </mesh>
      </group>
    </group>
  )
}

function BirthdayBalloons() {
  const group = useRef<THREE.Group>(null)
  useFestival(group, 'birthday')
  const balloons = useMemo(
    () => BALLOON_SITES.map(([id, turn], i) => ({ dir: openSpot(id, turn), color: BALLOON_COLORS[i % BALLOON_COLORS.length], seed: i * 0.37 })),
    [],
  )
  return (
    <group ref={group} visible={false}>
      {balloons.map((b, i) => (
        <Balloon key={i} dir={b.dir} color={b.color} seed={b.seed} />
      ))}
    </group>
  )
}

// ---------------------------------------------------------------------------- anniversary

function heartGeometry() {
  const s = new THREE.Shape()
  s.moveTo(0, -0.3)
  s.bezierCurveTo(-0.05, -0.2, -0.32, -0.05, -0.3, 0.12)
  s.bezierCurveTo(-0.28, 0.3, -0.05, 0.32, 0, 0.16)
  s.bezierCurveTo(0.05, 0.32, 0.28, 0.3, 0.3, 0.12)
  s.bezierCurveTo(0.32, -0.05, 0.05, -0.2, 0, -0.3)
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.08, bevelEnabled: false, curveSegments: 3 })
  g.center()
  return g
}

function ChapelHeart() {
  const ref = useRef<THREE.Mesh>(null)
  const frame = useMemo(() => {
    const lm = LANDMARKS.find((l) => l.id === 'chapel')
    return lm ? surfaceFrame(lm.dir, lm.yaw) : surfaceFrame(UP)
  }, [])
  const geo = useMemo(() => heartGeometry(), [])
  const mat = useMemo(() => ps1Material({ color: '#ff6a9a', emissive: '#ff4a8a', emissiveIntensity: 0.9 }), [])
  useFrame(({ clock }) => {
    const m = ref.current
    if (!m) return
    const t = clock.elapsedTime
    m.rotation.y = t * 0.9
    // A heartbeat: two quick pulses, then rest.
    const k = t % 1.4
    m.scale.setScalar(1 + (k < 0.12 ? k / 0.12 : k < 0.3 ? 1 - (k - 0.12) / 0.18 : 0) * 0.15)
  })
  return (
    <group position={frame.position} quaternion={frame.quaternion}>
      <mesh ref={ref} geometry={geo} material={mat} position={[1.5, 3.3, 0.6]} scale={2} />
      <Glow position={[1.5, 3.3, 0.6]} color="#ff7aa8" size={1.8} kind="always" opacity={0.45} />
    </group>
  )
}

/** Rose petals drifting down onto the whole planet. */
function Petals() {
  const { geo, seeds, dirs } = useMemo(() => {
    const rand = mulberry32(525)
    const n = 220
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3))
    const dirs = Array.from({ length: n }, () => new THREE.Vector3(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1).normalize())
    return { geo: g, seeds: Array.from({ length: n }, () => rand()), dirs }
  }, [])
  useFrame(({ clock }) => {
    const pos = geo.getAttribute('position')
    const t = clock.elapsedTime
    for (let i = 0; i < seeds.length; i++) {
      const k = (t * 0.06 + seeds[i]) % 1
      const r = PLANET_RADIUS + 4.5 - k * 4.2
      tmpA.copy(dirs[i]).multiplyScalar(r)
      pos.setXYZ(i, tmpA.x + Math.sin(t * 1.3 + i) * 0.2, tmpA.y + Math.cos(t * 1.1 + i) * 0.2, tmpA.z + Math.sin(t * 0.9 + i * 2) * 0.2)
    }
    pos.needsUpdate = true
  })
  return (
    <points geometry={geo}>
      <pointsMaterial color="#ff9dbd" size={0.16} transparent opacity={0.9} depthWrite={false} />
    </points>
  )
}

function Anniversary() {
  const group = useRef<THREE.Group>(null)
  useFestival(group, 'anniversary')
  return (
    <group ref={group} visible={false}>
      <ChapelHeart />
      <Petals />
    </group>
  )
}

// ---------------------------------------------------------------------------- root

/** Everything date-driven that lives on the planet. Each piece hides itself out of season. */
export function Seasonal({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <>
      <Fireworks reducedMotion={reducedMotion} />
      <Bonfire />
      <ChristmasTree />
      <Bats />
      <BirthdayBalloons />
      <Anniversary />
    </>
  )
}
