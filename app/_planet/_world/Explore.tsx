'use client'

import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import { avatarState, moveAvatar, nearbyLandmark } from '../_lib/avatarState'
import { readAxes } from '../_lib/input'
import { sound } from '../_lib/sound'
import type { LandmarkId } from '../_lib/planet'
import { rigState } from './CameraRig'

const WALK_SPEED = 1.7 // world units / s
const TURN_SPEED = 2.4 // rad / s

function setMoving(v: boolean) {
  avatarState.moving = v
}

/** Drives the avatar from input while exploring and reports the nearest door. */
export function ExploreController({ active, onNear }: { active: boolean; onNear: (id: LandmarkId | null) => void }) {
  const lastNear = useRef<LandmarkId | null>(null)
  const stride = useRef(0)
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    if (!active || rigState.flying) {
      setMoving(false)
      return
    }
    const { forward, turn } = readAxes()
    // Turn opposite to the screen direction because he faces away from the camera.
    const distance = forward * WALK_SPEED * dt
    const moved = moveAvatar(distance, -turn * TURN_SPEED * dt)
    if (moved) {
      stride.current += Math.abs(distance)
      if (stride.current > 0.45) {
        stride.current = 0
        sound.step()
      }
    }
    setMoving(moved || Math.abs(forward) > 0.1)
    const near = nearbyLandmark()?.id ?? null
    if (near !== lastNear.current) {
      lastNear.current = near
      onNear(near)
    }
  })
  return null
}
