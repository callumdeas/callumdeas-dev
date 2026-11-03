'use client'

import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import * as THREE from 'three'

const BASE_VFOV = 40
/** Keep at least this much horizontal view so portrait phones see the whole planet. */
const MIN_HFOV = 2 * THREE.MathUtils.radToDeg(Math.atan(Math.tan(THREE.MathUtils.degToRad(BASE_VFOV / 2)) * 1.05))

function fitFov(camera: THREE.Camera, aspect: number) {
  if (!(camera instanceof THREE.PerspectiveCamera)) return
  const needed = 2 * THREE.MathUtils.radToDeg(Math.atan(Math.tan(THREE.MathUtils.degToRad(MIN_HFOV / 2)) / aspect))
  camera.fov = Math.min(85, Math.max(BASE_VFOV, needed))
  camera.updateProjectionMatrix()
}

export function FovFit() {
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  useEffect(() => fitFov(camera, size.width / size.height), [camera, size])
  return null
}
