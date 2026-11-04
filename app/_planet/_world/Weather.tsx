'use client'

import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { env } from '../_lib/environment'
import { mulberry32 } from '../_lib/noise'
import { PLANET_RADIUS } from '../_lib/planet'
import { sound } from '../_lib/sound'
import { weather } from '../_lib/weather'

/**
 * Precipitation on a tiny planet falls *towards the centre*, so drops live in a
 * shell around the world and are recycled to the top of it when they land.
 */

const TOP = PLANET_RADIUS + 6
const GROUND = PLANET_RADIUS + 0.15
const Y = new THREE.Vector3(0, 1, 0)
const p = new THREE.Vector3()
const side = new THREE.Vector3()

type Shell = { pos: Float32Array; seeds: Float32Array; count: number }

function makeShell(count: number, seed: number): Shell {
  const rand = mulberry32(seed)
  const pos = new Float32Array(count * 3)
  const seeds = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    p.set(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1).normalize().multiplyScalar(GROUND + rand() * (TOP - GROUND))
    pos.set([p.x, p.y, p.z], i * 3)
    seeds[i] = rand()
  }
  return { pos, seeds, count }
}

/** Move one particle inwards (plus a sideways wind push); respawn it at the top of the shell when it lands. */
function fall(s: Shell, i: number, speed: number, wind: number, dt: number) {
  const o = i * 3
  p.set(s.pos[o], s.pos[o + 1], s.pos[o + 2])
  const r = p.length()
  side.crossVectors(Y, p).normalize()
  p.addScaledVector(p, (-speed * dt) / r).addScaledVector(side, wind * dt)
  if (p.length() < GROUND) p.normalize().multiplyScalar(TOP - s.seeds[i] * 1.5)
  s.pos[o] = p.x
  s.pos[o + 1] = p.y
  s.pos[o + 2] = p.z
}

const RAIN = 1400
const RAIN_LEN = 0.35

function stepRain(s: Shell, geo: THREE.BufferGeometry, mat: THREE.LineBasicMaterial, line: THREE.LineSegments, dt: number) {
  const level = weather.now.rain
  line.visible = level > 0.02
  if (!line.visible) return
  const active = Math.floor(RAIN * Math.min(1, level))
  const wind = weather.now.wind * 0.12
  const attr = geo.getAttribute('position')
  for (let i = 0; i < active; i++) {
    fall(s, i, 11, wind, dt)
    const o = i * 3
    p.set(s.pos[o], s.pos[o + 1], s.pos[o + 2])
    const r = p.length()
    side.crossVectors(Y, p).normalize().multiplyScalar(wind * 0.04)
    attr.setXYZ(i * 2, p.x, p.y, p.z)
    // Streak trails back up (and against the wind) from the head.
    attr.setXYZ(i * 2 + 1, p.x + (p.x / r) * RAIN_LEN - side.x, p.y + (p.y / r) * RAIN_LEN - side.y, p.z + (p.z / r) * RAIN_LEN - side.z)
  }
  attr.needsUpdate = true
  geo.setDrawRange(0, active * 2)
  mat.color.copy(env.colors.fog).lerp(WHITE, 0.45)
  mat.opacity = 0.35 + 0.35 * level
}

const WHITE = new THREE.Color('#ffffff')

function Rain() {
  const line = useRef<THREE.LineSegments>(null)
  const { shell, geo, mat } = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(RAIN * 6), 3))
    return { shell: makeShell(RAIN, 61), geo: g, mat: new THREE.LineBasicMaterial({ transparent: true, depthWrite: false }) }
  }, [])
  useFrame((_, dt) => {
    if (line.current) stepRain(shell, geo, mat, line.current, Math.min(dt, 0.05))
  })
  return <lineSegments ref={line} geometry={geo} material={mat} frustumCulled={false} visible={false} />
}

const SNOW = 1100

function stepSnow(s: Shell, geo: THREE.BufferGeometry, points: THREE.Points, t: number, dt: number) {
  const level = weather.now.snow
  points.visible = level > 0.02
  if (!points.visible) return
  const active = Math.floor(SNOW * Math.min(1, level))
  const attr = geo.getAttribute('position')
  const wind = weather.now.wind * 0.05
  for (let i = 0; i < active; i++) {
    fall(s, i, 1.1, wind, dt)
    const o = i * 3
    // Flakes wander as they drift down.
    const k = s.seeds[i] * 50
    attr.setXYZ(i, s.pos[o] + Math.sin(t * 1.3 + k) * 0.12, s.pos[o + 1] + Math.cos(t * 1.1 + k) * 0.12, s.pos[o + 2] + Math.sin(t * 0.9 + k * 1.7) * 0.12)
  }
  attr.needsUpdate = true
  geo.setDrawRange(0, active)
}

function Snow() {
  const points = useRef<THREE.Points>(null)
  const { shell, geo } = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SNOW * 3), 3))
    return { shell: makeShell(SNOW, 77), geo: g }
  }, [])
  useFrame(({ clock }, dt) => {
    if (points.current) stepSnow(shell, geo, points.current, clock.elapsedTime, Math.min(dt, 0.05))
  })
  return (
    <points ref={points} geometry={geo} frustumCulled={false} visible={false}>
      <pointsMaterial color="#f6f4ff" size={0.13} transparent opacity={0.95} depthWrite={false} />
    </points>
  )
}

type Storm = { next: number; strikes: number[] }

const BOLT = new THREE.Color('#dfe6ff')

/** Lightning: a double flicker of fill light, thunder a beat later. */
function stepStorm(s: Storm, t: number, reducedMotion: boolean, rand: () => number) {
  const storm = weather.now.storm
  if (storm > 0.25 && t > s.next) {
    s.next = t + (5 + rand() * 9) / storm
    s.strikes = [t, t + 0.09 + rand() * 0.08]
    sound.thunder(0.5 + rand() * 0.5, 0.4 + rand() * 1.6)
  }
  if (reducedMotion) return
  for (const at of s.strikes) {
    const k = t - at
    if (k >= 0 && k < 0.12) {
      env.flash = Math.max(env.flash, 1.6 * (1 - k / 0.12))
      env.flashColor.copy(BOLT)
    }
  }
}

function setRainSound(level: number) {
  sound.setRain(level)
}

export function WeatherFx({ reducedMotion }: { reducedMotion: boolean }) {
  const rand = useMemo(() => mulberry32(404), [])
  const storm = useRef<Storm>({ next: 4, strikes: [] })
  const lastRain = useRef(-1)
  useFrame(({ clock }) => {
    stepStorm(storm.current, clock.elapsedTime, reducedMotion, rand)
    const level = Math.round(weather.now.rain * 20) / 20
    if (level !== lastRain.current) {
      lastRain.current = level
      setRainSound(level)
    }
  })
  return (
    <>
      <Rain />
      <Snow />
    </>
  )
}
