'use client'

import { useFrame } from '@react-three/fiber'
import { useCallback, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { getTextures } from '../_lib/assets'
import { env } from '../_lib/environment'
import { LANDMARKS, surfaceFrame, surfaceRadius } from '../_lib/planet'
import { ps1Material } from '../_lib/ps1'
import { sound } from '../_lib/sound'
import { usePickable } from './interaction'

// ---------------------------------------------------------------------------
// The hidden cat: tucked behind the farmhouse silo. Click (or walk up) to find it.

/** Behind the silo, in the farmhouse's own frame (so it's on the flat pad). */
function catSpot() {
  const farm = LANDMARKS.find((l) => l.id === 'farmhouse')
  const frame = farm ? surfaceFrame(farm.dir, farm.yaw) : surfaceFrame(new THREE.Vector3(0, 0, 1))
  // Just outside the farmhouse's click box, then dropped onto the real ground.
  const position = new THREE.Vector3(2.05, 0, -1.1).applyQuaternion(frame.quaternion).add(frame.position)
  const dir = position.clone().normalize()
  position.copy(dir).multiplyScalar(surfaceRadius(dir) - 0.02)
  const quaternion = frame.quaternion.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 2.2))
  return { position, quaternion }
}

const CAT_SPOT = catSpot()

function hop(group: THREE.Group, t: number, since: number) {
  const k = t - since
  group.position.y = k < 0.5 ? Math.sin((k / 0.5) * Math.PI) * 0.25 : 0
}

function wag(tail: THREE.Object3D, t: number) {
  tail.rotation.z = Math.sin(t * 3) * 0.35
}

function setEyes(mat: THREE.MeshLambertMaterial) {
  mat.emissiveIntensity = 0.4 + env.night * 1.8
}

export function HiddenCat({ onFound }: { onFound: () => void }) {
  const body = useRef<THREE.Group>(null)
  const tail = useRef<THREE.Group>(null)
  const hopAt = useRef(-10)
  const m = useMemo(
    () => ({
      fur: ps1Material({ color: '#26222c' }),
      eye: ps1Material({ color: '#000000', emissive: '#f4d23a', emissiveIntensity: 1 }),
      nose: ps1Material({ color: '#e88aa0' }),
    }),
    [],
  )
  const pick = useCallback(() => {
    hopAt.current = performance.now() / 1000
    sound.meow()
    onFound()
  }, [onFound])
  const handlers = usePickable('cat', pick)

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (body.current) hop(body.current, performance.now() / 1000, hopAt.current)
    if (tail.current) wag(tail.current, t)
    setEyes(m.eye)
  })

  return (
    <group position={CAT_SPOT.position} quaternion={CAT_SPOT.quaternion} scale={0.85}>
      <group ref={body} {...handlers}>
        <mesh position={[0, 0.1, 0]} material={m.fur}>
          <boxGeometry args={[0.13, 0.12, 0.24]} />
        </mesh>
        <mesh position={[0, 0.2, 0.12]} material={m.fur}>
          <boxGeometry args={[0.13, 0.11, 0.1]} />
        </mesh>
        {[-0.04, 0.04].map((x) => (
          <mesh key={x} position={[x, 0.27, 0.12]} material={m.fur}>
            <coneGeometry args={[0.025, 0.05, 4]} />
          </mesh>
        ))}
        {[-0.03, 0.03].map((x) => (
          <mesh key={x} position={[x, 0.21, 0.172]} material={m.eye}>
            <boxGeometry args={[0.02, 0.02, 0.006]} />
          </mesh>
        ))}
        <mesh position={[0, 0.19, 0.172]} material={m.nose}>
          <boxGeometry args={[0.012, 0.01, 0.006]} />
        </mesh>
        {[-0.04, 0.04].map((x) =>
          [-0.08, 0.08].map((z) => (
            <mesh key={`${x}${z}`} position={[x, 0.03, z]} material={m.fur}>
              <boxGeometry args={[0.03, 0.06, 0.03]} />
            </mesh>
          )),
        )}
        <group ref={tail} position={[0, 0.14, -0.12]}>
          <mesh position={[0, 0.1, -0.02]} rotation={[-0.4, 0, 0]} material={m.fur}>
            <boxGeometry args={[0.025, 0.2, 0.025]} />
          </mesh>
        </group>
        {/* Generous invisible hit area: the cat is tiny. */}
        <mesh position={[0, 0.15, 0]} material={hiddenHit}>
          <boxGeometry args={[0.5, 0.4, 0.5]} />
        </mesh>
      </group>
    </group>
  )
}

const hiddenHit = new THREE.MeshBasicMaterial({ visible: false })

// ---------------------------------------------------------------------------
// Shooting stars: occasional at night, or on demand (click the moon).

export const shootingStars = { requested: 0 }

type Streak = { active: boolean; t: number; from: THREE.Vector3; dir: THREE.Vector3 }

const scratch = new THREE.Vector3()

function launch(s: Streak) {
  s.active = true
  s.t = 0
  const x = (Math.random() * 2 - 1) * 0.6
  s.from.set(x, 0.35 + Math.random() * 0.25, -1).normalize()
  s.dir.set(x > 0 ? -1 : 1, -0.45, 0).normalize()
}

function drawStreak(sprite: THREE.Sprite, s: Streak, camera: THREE.Camera, dt: number) {
  const mat = sprite.material
  if (!s.active) {
    sprite.visible = false
    return
  }
  s.t += dt / 0.9
  if (s.t >= 1) {
    s.active = false
    sprite.visible = false
    return
  }
  scratch.copy(s.from).addScaledVector(s.dir, s.t * 0.55).normalize().applyQuaternion(camera.quaternion)
  sprite.position.copy(camera.position).addScaledVector(scratch, 250)
  sprite.visible = true
  mat.rotation = Math.atan2(s.dir.y, s.dir.x)
  mat.opacity = Math.sin(s.t * Math.PI)
}

function consumeRequest() {
  const n = shootingStars.requested
  shootingStars.requested = 0
  return n > 0
}

export function ShootingStars() {
  const sprite = useRef<THREE.Sprite>(null)
  const streak = useRef<Streak>({ active: false, t: 0, from: new THREE.Vector3(), dir: new THREE.Vector3() })
  const next = useRef(20)
  useFrame(({ camera, clock }, dt) => {
    const s = streak.current
    const t = clock.elapsedTime
    const wanted = consumeRequest()
    if (!s.active && (wanted || (env.stars > 0.6 && t > next.current))) {
      launch(s)
      next.current = t + 12 + Math.random() * 25
    }
    if (sprite.current) drawStreak(sprite.current, s, camera, dt)
  })
  return (
    <sprite ref={sprite} scale={[22, 0.9, 1]} renderOrder={-7} visible={false}>
      <spriteMaterial map={getTextures().glow} color="#fff6e0" transparent depthWrite={false} fog={false} blending={THREE.AdditiveBlending} />
    </sprite>
  )
}
