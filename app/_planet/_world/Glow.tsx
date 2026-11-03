'use client'

import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import { getTextures } from '../_lib/assets'
import { env, lightsOn } from '../_lib/environment'

export type GlowKind = 'night' | 'neon' | 'always'

type Props = {
  position: [number, number, number]
  color: string
  size: number
  opacity?: number
  /** night: only after dusk; neon: dim by day, full at night; always: constant. */
  kind?: GlowKind
  /** Degrees of sun elevation to offset this light's switch-on (lamplighter effect). */
  stagger?: number
}

export function glowFactor(kind: GlowKind, stagger: number) {
  if (kind === 'always') return 1
  if (kind === 'neon') return 0.3 + 0.7 * env.night
  return lightsOn(stagger)
}

function applyGlow(sprite: THREE.Sprite, opacity: number) {
  sprite.material.opacity = opacity
  sprite.visible = opacity > 0.01
}

/** Additive billboard halo; stands in for bloom, which the PS1 never had. */
export function Glow({ position, color, size, opacity = 0.85, kind = 'night', stagger = 0 }: Props) {
  const ref = useRef<THREE.Sprite>(null)
  useFrame(() => {
    if (ref.current) applyGlow(ref.current, opacity * glowFactor(kind, stagger))
  })
  return (
    <sprite ref={ref} position={position} scale={[size, size, size]} renderOrder={2}>
      <spriteMaterial
        map={getTextures().glow}
        color={color}
        transparent
        opacity={opacity}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </sprite>
  )
}
