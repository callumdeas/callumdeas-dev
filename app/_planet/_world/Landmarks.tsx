'use client'

import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react'
import * as THREE from 'three'
import { disposePalette, makePalette, type Palette } from '../_lib/assets'
import { env, lightsOn } from '../_lib/environment'
import { LANDMARKS, surfaceFrame, type LandmarkId } from '../_lib/planet'
import { season } from '../_lib/seasons'
import { Glow, type GlowKind } from './Glow'
import { Marker, useInteraction, usePickable } from './interaction'

/** Built by scripts/blender/landmarks.py (pnpm assets:landmarks). */
const URL = '/models/landmarks.glb'

type V3 = [number, number, number]

// ---------------------------------------------------------------------------- placement + picking

const MARKER_HEIGHT: Record<LandmarkId, number> = {
  chapel: 5.0,
  workshop: 3.0,
  arcade: 3.0,
  farmhouse: 2.7,
  highstreet: 2.6,
  stadium: 3.6,
  postoffice: 2.9,
}

/** Invisible, generous click targets so small buildings are easy to pick. */
const HITBOX: Record<LandmarkId, { size: V3; y: number }> = {
  chapel: { size: [2.6, 4.8, 4.2], y: 2.0 },
  workshop: { size: [3.0, 2.8, 3.0], y: 1.1 },
  arcade: { size: [2.8, 2.8, 3.0], y: 1.1 },
  farmhouse: { size: [3.4, 2.4, 3.6], y: 0.9 },
  highstreet: { size: [5.6, 2.4, 2.6], y: 0.9 },
  stadium: { size: [4.2, 2.8, 3.8], y: 1.0 },
  postoffice: { size: [2.8, 2.6, 2.4], y: 1.0 },
}
const hitMaterial = new THREE.MeshBasicMaterial({ visible: false })

function Site({ id, children }: { id: LandmarkId; children: ReactNode }) {
  const lm = LANDMARKS.find((l) => l.id === id)
  const frame = useMemo(() => (lm ? surfaceFrame(lm.dir, lm.yaw) : null), [lm])
  const { hovered, selection, select } = useInteraction()
  const pick = useCallback(() => select({ kind: 'landmark', id }), [select, id])
  const handlers = usePickable(id, pick)
  if (!frame || !lm) return null
  return (
    <group position={frame.position} quaternion={frame.quaternion}>
      <group {...handlers}>
        {children}
        <mesh position={[0, HITBOX[id].y, 0]} material={hitMaterial}>
          <boxGeometry args={HITBOX[id].size} />
        </mesh>
      </group>
      <Marker
        height={MARKER_HEIGHT[id]}
        label={lm.project.toUpperCase()}
        sub={lm.title}
        hovered={hovered === id}
        hidden={selection !== null}
        phase={LANDMARKS.indexOf(lm) * 1.3}
      />
    </group>
  )
}

// ---------------------------------------------------------------------------- runtime extras

function tintSmoke(mat: THREE.MeshLambertMaterial) {
  mat.color.copy(env.colors.cloud)
}

/** Rising puffs from a chimney. */
function Smoke({ p }: { p: THREE.Vector3 }) {
  const group = useRef<THREE.Group>(null)
  const mat = useMemo(
    () => new THREE.MeshLambertMaterial({ flatShading: true, transparent: true, opacity: 0.55, depthWrite: false }),
    [],
  )
  const geo = useMemo(() => new THREE.IcosahedronGeometry(0.12, 0), [])
  useFrame(({ clock }) => {
    tintSmoke(mat)
    const g = group.current
    if (!g) return
    g.children.forEach((child, i) => {
      const t = (clock.elapsedTime * 0.35 + i / g.children.length) % 1
      child.position.set(Math.sin(t * 5 + i) * 0.08 + t * 0.25, t * 1.4, 0)
      const s = 0.5 + t * 1.6
      child.scale.setScalar(t > 0.85 ? s * (1 - (t - 0.85) / 0.15) : s)
    })
  })
  return (
    <group ref={group} position={p}>
      {Array.from({ length: 6 }, (_, i) => (
        <mesh key={i} geometry={geo} material={mat} />
      ))}
    </group>
  )
}

/** Knotless's emblem: a spinning gold knot crowning the spire. */
function Knot({ p, material }: { p: THREE.Vector3; material: THREE.Material }) {
  const ref = useRef<THREE.Mesh>(null)
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.8
  })
  return (
    <mesh ref={ref} position={p} material={material}>
      <torusKnotGeometry args={[0.16, 0.05, 32, 4]} />
    </mesh>
  )
}

// ---------------------------------------------------------------------------- GLB → PS1 materials

/** Blender material name → the site's PS1 material. */
function materialFor(name: string, m: Palette): THREE.Material {
  const indexed = /^(Facade|Awning|ShopSign)(\d)$/.exec(name)
  if (indexed) {
    const list = indexed[1] === 'Facade' ? m.facades : indexed[1] === 'Awning' ? m.awnings : m.shopSigns
    return list[Number(indexed[2]) % list.length]
  }
  const table: Record<string, THREE.Material> = {
    Plaster: m.plaster,
    Cream: m.cream,
    Stone: m.stone,
    Brick: m.brick,
    Wood: m.wood,
    WoodDark: m.woodDark,
    RoofRed: m.roofRed,
    RoofSlate: m.roofSlate,
    Dark: m.dark,
    Metal: m.metal,
    Silo: m.silo,
    White: m.white,
    Gold: m.gold,
    Window: m.window,
    Lamp: m.lamp,
    NeonPink: m.neonPink,
    NeonCyan: m.neonCyan,
    Screen: m.screen,
    ArcadeWall: m.arcadeWall,
    ArcadeSign: m.arcadeSign,
    DishSign: m.dishSign,
    FlowerPink: m.flowerPink,
    FlowerWhite: m.flowerWhite,
    Crop: m.crop,
    Soil: m.soil,
    Pumpkin: m.pumpkin,
    Hay: m.hay,
    Leaf: m.leaf,
    Pitch: m.pitch,
    PitchStripe: m.pitchStripe,
    SeatBlue: m.seatBlue,
    SeatWhite: m.seatWhite,
    Scoreboard: m.scoreboard,
    PostRed: m.postRed,
    PostSign: m.postSign,
  }
  return table[name] ?? m.dark
}

type Extras = {
  glows: { kind: GlowKind; color: string; size: number; position: V3; stagger: number }[]
  smoke: THREE.Vector3[]
  knot: THREE.Vector3 | null
  spinners: THREE.Object3D[]
}

/** Original Blender material names, remembered so re-running prepare() is idempotent. */
const sourceMaterial = new WeakMap<THREE.Mesh, string>()

function sourceName(mesh: THREE.Mesh) {
  let name = sourceMaterial.get(mesh)
  if (name === undefined) {
    name = mesh.material instanceof THREE.Material ? mesh.material.name : ''
    sourceMaterial.set(mesh, name)
  }
  return name
}

const isGlowKind = (k: string): k is GlowKind => k === 'night' || k === 'neon' || k === 'always'

/** Swap in PS1 materials and read the marker empties the Blender script left behind. */
function prepare(root: THREE.Object3D, m: Palette): Extras {
  const extras: Extras = { glows: [], smoke: [], knot: null, spinners: [] }
  root.updateMatrixWorld(true)
  const toRoot = new THREE.Matrix4().copy(root.matrixWorld).invert()
  const local = (o: THREE.Object3D) => new THREE.Vector3().setFromMatrixPosition(new THREE.Matrix4().multiplyMatrices(toRoot, o.matrixWorld))
  root.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.material = materialFor(sourceName(o), m)
    }
    if (o.name.startsWith('glow_')) {
      const [, kind, hex, size] = o.name.split('_')
      const p = local(o)
      if (isGlowKind(kind)) {
        extras.glows.push({
          kind,
          color: `#${hex.slice(0, 6)}`,
          size: Number(size) / 100,
          position: [p.x, p.y, p.z],
          stagger: (extras.glows.length % 5) * 0.6 - 1,
        })
      }
    } else if (o.name.startsWith('smoke')) extras.smoke.push(local(o))
    else if (o.name.startsWith('anchor_knot')) extras.knot = local(o)
    else if (o.name.startsWith('spin_')) extras.spinners.push(o)
  })
  return extras
}

function spin(objects: THREE.Object3D[], dt: number) {
  for (const o of objects) o.rotation.x += dt * 0.6
}

function Model({ id, palette }: { id: LandmarkId; palette: Palette }) {
  const { scene } = useGLTF(URL)
  const model = useMemo(() => {
    const root = scene.getObjectByName(id)
    if (!root) return null
    return { root, extras: prepare(root, palette) }
  }, [scene, id, palette])
  useFrame((_, dt) => {
    if (model) spin(model.extras.spinners, dt)
  })
  if (!model) return null
  const { root, extras } = model
  return (
    <>
      <primitive object={root} />
      {extras.glows.map((g, i) => (
        <Glow key={i} position={g.position} color={g.color} size={g.size} kind={g.kind} stagger={g.stagger} opacity={0.55} />
      ))}
      {extras.smoke.map((p, i) => (
        <Smoke key={i} p={p} />
      ))}
      {extras.knot && <Knot p={extras.knot} material={palette.gold} />}
    </>
  )
}

// ---------------------------------------------------------------------------- lighting + root

function setEmissive(mat: THREE.MeshLambertMaterial, intensity: number) {
  mat.emissiveIntensity = intensity
}

function driveLights(m: Palette, t: number) {
  setEmissive(m.window, 1.5 * lightsOn(0.5))
  setEmissive(m.lamp, 2.2 * lightsOn(1.5))
  setEmissive(m.screen, 0.6 + 1.0 * env.night)
  setEmissive(m.arcadeSign, 0.7 + 0.9 * env.night)
  setEmissive(m.scoreboard, 0.8 + 0.8 * env.night)
  // Shop signs get a soft night-time backlight.
  for (const sign of m.shopSigns) setEmissive(sign, 0.55 * lightsOn(0))
  setEmissive(m.postSign, 0.55 * lightsOn(0))
  // Arcade neon: always on, brighter at night, with the odd flicker.
  const neon = 0.3 + 0.7 * env.night
  const flick = Math.sin(t * 23) > 0.92 || Math.sin(t * 3.1) > 0.995 ? 0.4 : 2.2
  setEmissive(m.neonPink, flick * neon)
  setEmissive(m.neonCyan, (1.8 + Math.sin(t * 2) * 0.4) * neon)
}

const SNOW = new THREE.Color('#f2ecf2')
const PUMPKIN_GLOW = new THREE.Color('#ff7a1a')

/** Roofs whiten as snow settles; pumpkins become jack-o'-lanterns for Halloween. */
function useSeasonalMaterials(m: Palette) {
  const roofs = useMemo(
    () => [m.roofRed, m.roofSlate, m.roofTeal].map((mat) => ({ mat, base: mat.color.clone() })),
    [m],
  )
  useFrame(({ clock }) => driveSeasonal(m, roofs, clock.elapsedTime))
}

function driveSeasonal(m: Palette, roofs: { mat: THREE.MeshLambertMaterial; base: THREE.Color }[], t: number) {
  for (const r of roofs) r.mat.color.copy(r.base).lerp(SNOW, env.snow * 0.8)
  const lit = season.festival === 'halloween' ? lightsOn(0) : 0
  m.pumpkin.emissive.set(PUMPKIN_GLOW)
  m.pumpkin.emissiveIntensity = lit * (1.3 + Math.sin(t * 7) * 0.2)
}

export function Landmarks() {
  const palette = useMemo(() => makePalette(), [])
  useEffect(() => () => disposePalette(palette), [palette])
  useFrame(({ clock }) => driveLights(palette, clock.elapsedTime))
  useSeasonalMaterials(palette)
  return (
    <>
      {LANDMARKS.map((lm) => (
        <Site key={lm.id} id={lm.id}>
          <Model id={lm.id} palette={palette} />
        </Site>
      ))}
    </>
  )
}

useGLTF.preload(URL)
