'use client'

import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { getTextures } from '../_lib/assets'
import { mulberry32 } from '../_lib/noise'
import {
  PATHS,
  PLANET_RADIUS,
  SEA_LEVEL,
  padDistance,
  pathDistance,
  pointOnArc,
  surfaceFrame,
  surfaceRadius,
} from '../_lib/planet'
import { ART } from '../_lib/art'
import { env, lightsOn } from '../_lib/environment'
import { season } from '../_lib/seasons'
import { useFrame } from '@react-three/fiber'
import { ps1Material } from '../_lib/ps1'
import { Glow } from './Glow'
import { occluderHandlers } from './interaction'

type FaceKind = 'seabed' | 'sand' | 'path' | 'rock' | 'snow' | 'grass'

type PlanetData = {
  geometry: THREE.BufferGeometry
  faces: { kind: FaceKind; variant: number; shade: number; snowAt: number }[]
}

function buildPlanet(): PlanetData {
  const geometry = new THREE.IcosahedronGeometry(1, 22)
  const pos = geometry.getAttribute('position')
  const dir = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    dir.fromBufferAttribute(pos, i).normalize()
    const r = surfaceRadius(dir)
    pos.setXYZ(i, dir.x * r, dir.y * r, dir.z * r)
  }

  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  const centroid = new THREE.Vector3()
  const normal = new THREE.Vector3()
  const rand = mulberry32(7)
  const faces: PlanetData['faces'] = []

  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i)
    b.fromBufferAttribute(pos, i + 1)
    c.fromBufferAttribute(pos, i + 2)
    centroid.copy(a).add(b).add(c).divideScalar(3)
    const h = centroid.length()
    const radial = centroid.clone().normalize()
    normal.subVectors(b, a).cross(c.clone().sub(a)).normalize()
    const slope = 1 - Math.abs(normal.dot(radial))

    let kind: FaceKind = 'grass'
    if (h < SEA_LEVEL - 0.04) kind = 'seabed'
    else if (h < SEA_LEVEL + 0.16) kind = 'sand'
    else if (pathDistance(radial) < 0.045) kind = 'path'
    else if (h > PLANET_RADIUS + 1.75) kind = 'snow'
    else if (slope > 0.32 || h > PLANET_RADIUS + 1.2) kind = 'rock'

    // Snow settles first on high, flat ground; snowAt is the cover level at which this face turns white.
    const up = Math.max(0, Math.min(1, (h - SEA_LEVEL) / 1.6))
    const snowAt = Math.min(1, rand() * 0.75 + slope * 1.4 + (1 - up) * 0.25)
    faces.push({ kind, variant: Math.floor(rand() * 4), shade: 0.95 + rand() * 0.1, snowAt })
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(pos.count * 3), 3))
  geometry.computeVertexNormals()
  return { geometry, faces }
}

/** What the ground looks like right now: season blend plus snow lying. */
type GroundLook = { winter: number; spring: number; autumn: number; snow: number }

const SEASON_GRASS = {
  autumn: new THREE.Color('#9a8a48'),
  winter: new THREE.Color('#717c6c'),
  spring: new THREE.Color('#82ab58'),
}

const lookKey = (l: GroundLook) => [l.winter, l.spring, l.autumn, l.snow].map((v) => Math.round(v * 40)).join()

function currentLook(): GroundLook {
  return { winter: season.winter, spring: season.spring, autumn: season.autumn, snow: env.snow }
}

function paintPlanet(data: PlanetData, look: GroundLook) {
  const colors = data.geometry.getAttribute('color')
  const tmp = new THREE.Color()
  const snow = new THREE.Color(ART.ground.snow)
  const g = ART.ground
  data.faces.forEach((face, f) => {
    switch (face.kind) {
      case 'seabed':
        tmp.set(g.seabed)
        break
      case 'sand':
        tmp.set(g.sand)
        break
      case 'path':
        tmp.set(g.path)
        break
      case 'rock':
        tmp.set(g.rock)
        break
      case 'snow':
        tmp.set(g.snow)
        break
      case 'grass':
        tmp.set(g.grass[face.variant % g.grass.length])
        tmp.lerp(SEASON_GRASS.autumn, look.autumn * 0.4)
        tmp.lerp(SEASON_GRASS.winter, look.winter * 0.4)
        tmp.lerp(SEASON_GRASS.spring, look.spring * 0.25)
        break
    }
    const settles = face.kind === 'grass' || face.kind === 'rock' || face.kind === 'path'
    const cover = face.kind === 'path' ? look.snow - 0.3 : look.snow
    if (settles && cover > face.snowAt) tmp.copy(snow)
    tmp.multiplyScalar(face.shade)
    for (let k = 0; k < 3; k++) colors.setXYZ(f * 3 + k, tmp.r, tmp.g, tmp.b)
  })
  colors.needsUpdate = true
}

export function Planet() {
  const data = useMemo(() => buildPlanet(), [])
  const material = useMemo(() => ps1Material({ vertexColors: true, map: getTextures().grain }), [])
  const painted = useRef('')
  useLayoutEffect(() => {
    const look = currentLook()
    paintPlanet(data, look)
    painted.current = lookKey(look)
  }, [data])
  // Repaint only when the season or snow has visibly moved on.
  useFrame(() => {
    const look = currentLook()
    const key = lookKey(look)
    if (key === painted.current) return
    painted.current = key
    paintPlanet(data, look)
  })
  return <mesh geometry={data.geometry} material={material} {...occluderHandlers} />
}

function tintOcean(mat: THREE.MeshLambertMaterial) {
  mat.color.copy(env.colors.ocean)
}

export function Ocean() {
  const geometry = useMemo(() => new THREE.IcosahedronGeometry(SEA_LEVEL, 14), [])
  const material = useMemo(
    () => ps1Material({ color: '#41438f', transparent: true, opacity: 0.8, wobble: 0.05, depthWrite: false }),
    [],
  )
  useFrame(() => tintOcean(material))
  return <mesh geometry={geometry} material={material} renderOrder={1} />
}

type TreeInstance = { matrix: THREE.Matrix4; colorIndex: number; kind: 'pine' | 'round' }

function scatterTrees(): TreeInstance[] {
  const rand = mulberry32(42)
  const trees: TreeInstance[] = []
  const dir = new THREE.Vector3()
  let attempts = 0
  while (trees.length < 140 && attempts < 6000) {
    attempts++
    dir.set(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1)
    if (dir.lengthSq() > 1 || dir.lengthSq() < 0.01) continue
    dir.normalize()
    const h = surfaceRadius(dir)
    if (h < SEA_LEVEL + 0.2 || h > PLANET_RADIUS + 1.6) continue
    if (padDistance(dir) < 0.05 || pathDistance(dir) < 0.07) continue
    const { position, quaternion } = surfaceFrame(dir, rand() * Math.PI * 2, -0.05)
    const s = 0.7 + rand() * 0.7
    const matrix = new THREE.Matrix4().compose(position, quaternion, new THREE.Vector3(s, s * (0.9 + rand() * 0.5), s))
    trees.push({ matrix, colorIndex: Math.floor(rand() * 5), kind: rand() < 0.55 ? 'pine' : 'round' })
  }
  return trees
}

/** Writes instance transforms into an InstancedMesh. */
function fillMatrices(mesh: THREE.InstancedMesh | null, list: TreeInstance[]) {
  if (!mesh) return
  list.forEach((t, i) => mesh.setMatrixAt(i, t.matrix))
  mesh.instanceMatrix.needsUpdate = true
}

const toColors = (list: readonly string[]) => list.map((c) => new THREE.Color(c))

/** Canopy palettes per season. Pines stay evergreen; round trees turn, go bare and blossom. */
const CANOPY = {
  pine: {
    summer: toColors(ART.foliage.slice(0, 3)),
    autumn: toColors(['#3a5a48', '#4f6a44', '#2c4844']),
    winter: toColors(['#2f4a44', '#3a5446', '#26403e']),
    spring: toColors(['#4a7052', '#62824e', '#365a4c']),
  },
  round: {
    summer: toColors(ART.foliage),
    autumn: toColors(['#c2622f', '#d89a3a', '#a8402f', '#b57b2c', '#8a4f5a']),
    winter: toColors(['#6b5a52', '#5e5552', '#74645a', '#5a5048', '#6a5a5e']),
    spring: toColors(['#e7a3bf', '#9cc46a', '#f0c4d4', '#7fae5a', '#d98fae']),
  },
}

const SNOW_TOP = new THREE.Color('#f4eef4')
const mixed = new THREE.Color()

function canopyColor(kind: TreeInstance['kind'], index: number, look: GroundLook, out: THREE.Color) {
  const p = CANOPY[kind]
  const pick = (list: THREE.Color[]) => list[index % list.length]
  const summer = Math.max(0, 1 - look.winter - look.spring - look.autumn)
  out.setRGB(0, 0, 0)
  out.add(mixed.copy(pick(p.summer)).multiplyScalar(summer))
  out.add(mixed.copy(pick(p.autumn)).multiplyScalar(look.autumn))
  out.add(mixed.copy(pick(p.winter)).multiplyScalar(look.winter))
  out.add(mixed.copy(pick(p.spring)).multiplyScalar(look.spring))
  return out.lerp(SNOW_TOP, look.snow * 0.65)
}

function paintCanopies(mesh: THREE.InstancedMesh | null, list: TreeInstance[], look: GroundLook) {
  if (!mesh) return
  const color = new THREE.Color()
  list.forEach((t, i) => mesh.setColorAt(i, canopyColor(t.kind, t.colorIndex, look, color)))
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
}

function pineCanopy() {
  const geo = new THREE.ConeGeometry(0.34, 0.95, 5)
  geo.translate(0, 0.75, 0)
  return geo
}
function roundCanopy() {
  const geo = new THREE.IcosahedronGeometry(0.36, 0)
  geo.scale(1, 1.15, 1)
  geo.translate(0, 0.62, 0)
  return geo
}
function trunk() {
  const geo = new THREE.CylinderGeometry(0.05, 0.08, 0.4, 4)
  geo.translate(0, 0.2, 0)
  return geo
}

export function Trees() {
  const trees = useMemo(() => scatterTrees(), [])
  const pines = useMemo(() => trees.filter((t) => t.kind === 'pine'), [trees])
  const rounds = useMemo(() => trees.filter((t) => t.kind === 'round'), [trees])
  const geos = useMemo(() => ({ pine: pineCanopy(), round: roundCanopy(), trunk: trunk() }), [])
  const leafMat = useMemo(() => ps1Material({ color: '#ffffff' }), [])
  const trunkMat = useMemo(() => ps1Material({ color: '#5a3f33' }), [])

  const pineRef = useRef<THREE.InstancedMesh>(null)
  const roundRef = useRef<THREE.InstancedMesh>(null)
  const trunkRef = useRef<THREE.InstancedMesh>(null)

  const painted = useRef('')
  useLayoutEffect(() => {
    fillMatrices(pineRef.current, pines)
    fillMatrices(roundRef.current, rounds)
    fillMatrices(trunkRef.current, trees)
    painted.current = ''
  }, [pines, rounds, trees])
  useFrame(() => {
    const look = currentLook()
    const key = lookKey(look)
    if (key === painted.current) return
    painted.current = key
    paintCanopies(pineRef.current, pines, look)
    paintCanopies(roundRef.current, rounds, look)
  })

  return (
    <>
      <instancedMesh ref={pineRef} args={[geos.pine, leafMat, pines.length]} />
      <instancedMesh ref={roundRef} args={[geos.round, leafMat, rounds.length]} />
      <instancedMesh ref={trunkRef} args={[geos.trunk, trunkMat, trees.length]} />
    </>
  )
}

export function Rocks() {
  const rocks = useMemo(() => {
    const rand = mulberry32(99)
    const out: THREE.Matrix4[] = []
    const dir = new THREE.Vector3()
    let attempts = 0
    while (out.length < 40 && attempts < 3000) {
      attempts++
      dir.set(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1).normalize()
      const h = surfaceRadius(dir)
      if (h < SEA_LEVEL - 0.1 || padDistance(dir) < 0.04 || pathDistance(dir) < 0.06) continue
      const { position, quaternion } = surfaceFrame(dir, rand() * 6, -0.04)
      const s = 0.12 + rand() * 0.28
      out.push(new THREE.Matrix4().compose(position, quaternion, new THREE.Vector3(s, s * 0.7, s * (0.8 + rand() * 0.4))))
    }
    return out
  }, [])
  const geo = useMemo(() => new THREE.DodecahedronGeometry(1, 0), [])
  const mat = useMemo(() => ps1Material({ color: ART.ground.rock }), [])
  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    rocks.forEach((m, i) => mesh.setMatrixAt(i, m))
    mesh.instanceMatrix.needsUpdate = true
  }, [rocks, mat])
  return <instancedMesh ref={ref} args={[geo, mat, rocks.length]} />
}

function setBulb(mat: THREE.MeshLambertMaterial, stagger: number) {
  mat.emissiveIntensity = 2.4 * lightsOn(stagger)
}

/** Lamp posts lining the paths; each switches on at its own moment as dusk falls. */
export function Lamps() {
  const lamps = useMemo(() => {
    const rand = mulberry32(5)
    const out: { position: THREE.Vector3; quaternion: THREE.Quaternion; stagger: number; bulb: THREE.MeshLambertMaterial }[] = []
    PATHS.forEach(([a, b], pi) => {
      for (const t of [0.3, 0.5, 0.7]) {
        const side = (pi + t * 10) % 2 < 1 ? 0.055 : -0.055
        const dir = pointOnArc(a, b, t, side)
        if (surfaceRadius(dir) < SEA_LEVEL + 0.1) continue
        out.push({
          ...surfaceFrame(dir, 0, -0.02),
          stagger: rand() * 4 - 1,
          bulb: ps1Material({ color: '#3a3440', emissive: ART.lampGlow, emissiveIntensity: 2.4 }),
        })
      }
    })
    return out
  }, [])
  const postMat = useMemo(() => ps1Material({ color: '#2c2a33' }), [])
  useFrame(() => lamps.forEach((l) => setBulb(l.bulb, l.stagger)))
  return (
    <>
      {lamps.map((l, i) => (
        <group key={i} position={l.position} quaternion={l.quaternion}>
          <mesh position={[0, 0.3, 0]} material={postMat}>
            <cylinderGeometry args={[0.025, 0.035, 0.6, 4]} />
          </mesh>
          <mesh position={[0, 0.64, 0]} material={l.bulb}>
            <boxGeometry args={[0.1, 0.1, 0.1]} />
          </mesh>
          <mesh position={[0, 0.71, 0]} material={postMat}>
            <coneGeometry args={[0.1, 0.07, 4]} />
          </mesh>
          <Glow position={[0, 0.64, 0]} color={ART.lampGlow} size={0.9} stagger={l.stagger} />
        </group>
      ))}
    </>
  )
}
