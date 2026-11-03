'use client'

import { Html } from '@react-three/drei'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { createContext, useContext, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { ART } from '../_lib/art'
import type { Selection } from '../_lib/selection'
import { markerTexture } from '../_lib/textures'
import { sound } from '../_lib/sound'

export type HoverTarget = string | null

type Interaction = {
  selection: Selection
  hovered: HoverTarget
  setHovered: (h: HoverTarget) => void
  select: (s: Selection) => void
}

export const InteractionContext = createContext<Interaction>({
  selection: null,
  hovered: null,
  setHovered: () => {},
  select: () => {},
})

export const useInteraction = () => useContext(InteractionContext)

/** Pixels the pointer may travel between down and up and still count as a click (not an orbit drag). */
const CLICK_SLOP = 6

function setCursor(target: EventTarget | null, value: string) {
  if (target instanceof HTMLElement) target.style.cursor = value
}

/** Pointer handlers that make a group hoverable/clickable without stealing orbit drags. */
export function usePickable(key: string, onPick: () => void) {
  const { setHovered } = useInteraction()
  return useMemo(
    () => ({
      onPointerOver: (e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation()
        setHovered(key)
        setCursor(e.nativeEvent.target, 'pointer')
        sound.hover()
      },
      onPointerOut: (e: ThreeEvent<PointerEvent>) => {
        setHovered(null)
        setCursor(e.nativeEvent.target, 'grab')
      },
      onClick: (e: ThreeEvent<MouseEvent>) => {
        if (e.delta > CLICK_SLOP) return
        e.stopPropagation()
        onPick()
      },
    }),
    [key, onPick, setHovered],
  )
}

/** Blocks picking through the planet (things on the far side can't be hovered). */
export const occluderHandlers = {
  onPointerOver: (e: ThreeEvent<PointerEvent>) => e.stopPropagation(),
  onClick: (e: ThreeEvent<MouseEvent>) => e.stopPropagation(),
}

let markerTex: THREE.Texture | null = null
const getMarkerTexture = () => (markerTex ??= markerTexture())

function bobMarker(sprite: THREE.Sprite, baseY: number, t: number, phase: number, hovered: boolean, hidden: boolean) {
  sprite.position.y = baseY + Math.abs(Math.sin(t * 2.4 + phase)) * 0.25
  const target = hidden ? 0 : hovered ? 1.35 : 1.0
  const s = THREE.MathUtils.lerp(sprite.scale.x, target, 0.2)
  sprite.scale.setScalar(s)
  sprite.visible = s > 0.02
}

/** Floating "point of interest" arrow plus a name tag on hover. */
export function Marker({ height, label, sub, hovered, hidden, phase = 0 }: {
  height: number
  label: string
  sub: string
  hovered: boolean
  hidden: boolean
  phase?: number
}) {
  const ref = useRef<THREE.Sprite>(null)
  useFrame(({ clock }) => {
    if (ref.current) bobMarker(ref.current, height, clock.elapsedTime, phase, hovered, hidden)
  })
  return (
    <>
      <sprite ref={ref} position={[0, height, 0]} scale={0.55} renderOrder={5}>
        <spriteMaterial map={getMarkerTexture()} color={hovered ? '#ffffff' : ART.accent} fog={false} />
      </sprite>
      {hovered && !hidden && (
        <Html position={[0, height + 0.9, 0]} center zIndexRange={[20, 10]} style={{ pointerEvents: 'none' }}>
          <div
            className="whitespace-nowrap px-3 py-1.5 text-center"
            style={{
              fontFamily: 'var(--font-pixel), monospace',
              background: 'rgba(12,10,24,0.85)',
              border: '2px solid rgba(255,255,255,0.9)',
              boxShadow: '3px 3px 0 rgba(0,0,0,0.5)',
              color: '#fff',
            }}
          >
            <div className="text-2xl leading-none" style={{ color: ART.accent }}>
              {label}
            </div>
            <div className="mt-0.5 text-base leading-none opacity-80">{sub}</div>
          </div>
        </Html>
      )}
    </>
  )
}
