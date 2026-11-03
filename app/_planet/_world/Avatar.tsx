'use client'

import { useAnimations, useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { avatarFrame, avatarState } from '../_lib/avatarState'
import { ps1Material } from '../_lib/ps1'
import { Marker, useInteraction, usePickable } from './interaction'

export type Outfit = 'beanie' | 'cap'
const URLS: Record<Outfit, string> = { beanie: '/models/avatar.glb', cap: '/models/avatar-cap.glb' }
/** Model is authored 1.0 tall; this makes him a touch shorter than a door. */
const SCALE = 0.68

export type AvatarClip = 'idle' | 'walk' | 'wave'

/** Imperative hooks for the review HUD (and later, explore mode). */
export const avatarControl: { clip: AvatarClip; autoWave: boolean; waveNow: boolean; exploring: boolean } = {
  clip: 'idle',
  autoWave: true,
  waveNow: false,
  exploring: false,
}

function consumeWaveNow() {
  const v = avatarControl.waveNow
  avatarControl.waveNow = false
  return v
}

const avatarHit = new THREE.MeshBasicMaterial({ visible: false })

function placeAvatar(g: THREE.Group) {
  const f = avatarFrame()
  g.position.copy(f.position)
  g.quaternion.copy(f.quaternion)
}

function applyPS1Materials(root: THREE.Object3D, body: THREE.Material, lens: THREE.Material) {
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return
    const current = obj.material
    const name = current instanceof THREE.Material ? current.name : ''
    obj.material = name === 'Lens' ? lens : body
    obj.frustumCulled = false
  })
}

export function Avatar({ outfit, onSecretTaps }: { outfit: Outfit; onSecretTaps: () => void }) {
  const group = useRef<THREE.Group>(null)
  const { scene, animations } = useGLTF(URLS[outfit])
  const { actions } = useAnimations(animations, group)
  const materials = useMemo(
    () => ({
      body: ps1Material({ vertexColors: true }),
      lens: ps1Material({ vertexColors: true, transparent: true, opacity: 0.45, depthWrite: false }),
    }),
    [],
  )

  useEffect(() => {
    applyPS1Materials(scene, materials.body, materials.lens)
  }, [scene, materials])

  const { hovered, selection, select } = useInteraction()
  const taps = useRef<number[]>([])
  const pick = useCallback(() => {
    const now = performance.now()
    taps.current = [...taps.current.filter((t) => now - t < 2500), now]
    if (taps.current.length >= 5) {
      taps.current = []
      onSecretTaps()
    }
    select({ kind: 'avatar' })
    avatarControl.waveNow = true
  }, [select, onSecretTaps])
  const handlers = usePickable('avatar', pick)

  const placement = useRef<THREE.Group>(null)
  const playing = useRef<AvatarClip | null>(null)
  const nextWave = useRef(6)

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (consumeWaveNow()) nextWave.current = t
    const root = placement.current
    if (root) placeAvatar(root)
    let want: AvatarClip = avatarState.moving ? 'walk' : avatarControl.clip
    if (want === 'idle' && avatarControl.autoWave && !avatarControl.exploring) {
      if (t > nextWave.current + 2.2) nextWave.current = t + 8 + Math.random() * 6
      else if (t > nextWave.current) want = 'wave'
    }
    if (want === playing.current) return
    const next = actions[want]
    if (!next) return
    const prev = playing.current ? actions[playing.current] : null
    next.reset().setLoop(THREE.LoopRepeat, Infinity).fadeIn(0.25).play()
    prev?.fadeOut(0.25)
    playing.current = want
  })

  return (
    <group ref={placement}>
      <group ref={group} scale={SCALE} {...handlers}>
        <primitive object={scene} />
        <mesh position={[0, 0.5, 0]} material={avatarHit}>
          <boxGeometry args={[0.9, 1.2, 0.9]} />
        </mesh>
      </group>
      <Marker
        height={1.25}
        label="SAY HI"
        sub="About Callum"
        hovered={hovered === 'avatar'}
        hidden={selection !== null || avatarControl.exploring}
        phase={4}
      />
    </group>
  )
}

useGLTF.preload(URLS.beanie)
