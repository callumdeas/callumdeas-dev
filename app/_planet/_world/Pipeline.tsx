'use client'

import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { createPostMaterial, ps1Uniforms } from '../_lib/ps1'

/**
 * Takes over R3F's render loop: draw the scene into a tiny render target,
 * then upscale it with nearest filtering through the dither/quantise pass.
 */
export function PS1Pipeline({ height }: { height: number }) {
  const { gl, size, scene, camera } = useThree()

  const target = useMemo(
    () =>
      new THREE.WebGLRenderTarget(1, 1, {
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        generateMipmaps: false,
        depthBuffer: true,
        type: THREE.HalfFloatType,
      }),
    [],
  )

  const post = useMemo(() => {
    const material = createPostMaterial()
    material.uniforms.tDiffuse.value = target.texture
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material)
    quad.frustumCulled = false
    const postScene = new THREE.Scene()
    postScene.add(quad)
    return { scene: postScene, camera: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), material }
  }, [target])

  useEffect(() => {
    const w = Math.max(1, Math.round((height * size.width) / size.height))
    target.setSize(w, height)
    ps1Uniforms.uSnapRes.value.set(w, height)
    post.material.uniforms.uRes.value.set(w, height)
  }, [height, size.width, size.height, target, post])

  useEffect(
    () => () => {
      target.dispose()
      post.material.dispose()
    },
    [target, post],
  )

  useFrame((_, delta) => {
    ps1Uniforms.uTime.value += delta
    gl.setRenderTarget(target)
    gl.clear()
    gl.render(scene, camera)
    gl.setRenderTarget(null)
    gl.render(post.scene, post.camera)
  }, 1)

  return null
}
