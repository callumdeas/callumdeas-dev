'use client'

import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { ART } from '../_lib/art'
import { getTextures } from '../_lib/assets'
import { env, simNow, updateEnvironment } from '../_lib/environment'
import { mulberry32 } from '../_lib/noise'
import { PLANET_RADIUS } from '../_lib/planet'
import { ps1Material } from '../_lib/ps1'
import { moonTexture, sunTexture } from '../_lib/textures'

const scratch = new THREE.Vector3()

/** Sky-frame direction → world direction for the current camera. */
const toWorld = (dir: THREE.Vector3, camera: THREE.Camera, out: THREE.Vector3) =>
  out.copy(dir).applyQuaternion(camera.quaternion)

function syncFog(scene: THREE.Scene) {
  if (scene.fog instanceof THREE.Fog) scene.fog.color.copy(env.colors.fog)
}

/** Advances the clock and recomputes the whole lighting rig before anything else draws. */
export function EnvironmentDriver() {
  const scene = useThree((s) => s.scene)
  useFrame(() => {
    updateEnvironment(simNow())
    syncFog(scene)
  }, -1)
  return <fog attach="fog" args={['#000000', 26, 62]} />
}

function setSkyUniforms(material: THREE.ShaderMaterial) {
  const u = material.uniforms
  u.uTop.value.copy(env.colors.skyTop)
  u.uMid.value.copy(env.colors.skyMid)
  u.uBottom.value.copy(env.colors.skyBottom)
  u.uGlow.value.copy(env.colors.glow)
  u.uSunDir.value.copy(env.sunDir)
  // Glow is strongest when the sun is near the horizon.
  const el = env.sky.sun.elevation
  u.uGlowStrength.value = Math.max(0, 1 - Math.abs(el - 1) / 22) * 0.9 + (el > 0 ? 0.2 : 0)
}

/** Screen-space gradient dome with a halo around the real sun position. */
export function Sky() {
  const mesh = useRef<THREE.Mesh>(null)
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          uTop: { value: new THREE.Color() },
          uMid: { value: new THREE.Color() },
          uBottom: { value: new THREE.Color() },
          uGlow: { value: new THREE.Color() },
          uSunDir: { value: new THREE.Vector3() },
          uGlowStrength: { value: 0 },
        },
        vertexShader: /* glsl */ `
          varying vec3 vViewDir;
          void main() {
            vViewDir = (modelViewMatrix * vec4(position, 0.0)).xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uTop;
          uniform vec3 uMid;
          uniform vec3 uBottom;
          uniform vec3 uGlow;
          uniform vec3 uSunDir;
          uniform float uGlowStrength;
          varying vec3 vViewDir;
          void main() {
            vec3 d = normalize(vViewDir);
            float y = d.y;
            vec3 c = y > 0.0
              ? mix(uMid, uTop, smoothstep(0.0, 0.6, y))
              : mix(uMid, uBottom, smoothstep(0.0, -0.45, y));
            vec3 sd = normalize(uSunDir);
            float s = max(dot(d, sd), 0.0);
            float halo = pow(s, 6.0) * 0.55 + pow(s, 48.0) * 0.6;
            // Light bleeds along the horizon on the sun's side.
            vec2 dh = normalize(d.xz + vec2(1e-4));
            vec2 sh = normalize(sd.xz + vec2(1e-4));
            float band = exp(-abs(y - sd.y) * 5.0) * pow(max(dot(dh, sh), 0.0), 3.0) * 0.45;
            c += uGlow * (halo + band) * uGlowStrength;
            gl_FragColor = vec4(c, 1.0);
          }
        `,
      }),
    [],
  )
  useEffect(() => () => material.dispose(), [material])
  useFrame(({ camera }) => {
    mesh.current?.position.copy(camera.position)
    setSkyUniforms(material)
  })
  return (
    <mesh ref={mesh} material={material} renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[400, 24, 16]} />
    </mesh>
  )
}

function placeInSky(sprite: THREE.Sprite, dir: THREE.Vector3, camera: THREE.Camera) {
  toWorld(dir, camera, scratch)
  sprite.position.copy(camera.position).addScaledVector(scratch, 300)
}

function setSpriteLook(sprite: THREE.Sprite, color: THREE.Color, opacity: number, size: number) {
  const mat = sprite.material
  mat.color.copy(color)
  mat.opacity = opacity
  sprite.scale.setScalar(size)
  sprite.visible = opacity > 0.01
}

const SUN_LOW = new THREE.Color('#ff8a4a')
const SUN_HIGH = new THREE.Color('#fff6e4')
const sunColor = new THREE.Color()

export function Sun() {
  const sprite = useRef<THREE.Sprite>(null)
  const map = useMemo(() => sunTexture(), [])
  useFrame(({ camera }) => {
    const s = sprite.current
    if (!s) return
    const el = env.sky.sun.elevation
    placeInSky(s, env.sunDir, camera)
    sunColor.lerpColors(SUN_LOW, SUN_HIGH, THREE.MathUtils.smoothstep(el, 0, 25))
    // Bigger and redder near the horizon.
    setSpriteLook(s, sunColor, THREE.MathUtils.smoothstep(el, -4, 1), 55 + (1 - THREE.MathUtils.smoothstep(el, 0, 30)) * 35)
  })
  return (
    <sprite ref={sprite} renderOrder={-9}>
      <spriteMaterial map={map} fog={false} depthWrite={false} transparent />
    </sprite>
  )
}

function swapMoonTexture(sprite: THREE.Sprite, phaseAngle: number) {
  const mat = sprite.material
  mat.map?.dispose()
  mat.map = moonTexture(phaseAngle)
  mat.needsUpdate = true
}

const MOON_TINT = new THREE.Color('#f0f4ff')

export function Moon({ onClick }: { onClick?: () => void }) {
  const sprite = useRef<THREE.Sprite>(null)
  const drawnPhase = useRef(-999)
  useFrame(({ camera }) => {
    const s = sprite.current
    if (!s) return
    const phase = env.sky.moon.phaseAngle
    if (Math.abs(phase - drawnPhase.current) > 2) {
      swapMoonTexture(s, phase)
      drawnPhase.current = phase
    }
    placeInSky(s, env.moonDir, camera)
    // Daytime moon: pale ghost; night moon: bright.
    const opacity = THREE.MathUtils.smoothstep(env.sky.moon.elevation, -3, 1) * (0.35 + 0.65 * env.night)
    setSpriteLook(s, MOON_TINT, opacity, 52)
  })
  return (
    <sprite
      ref={sprite}
      renderOrder={-9}
      onClick={(e) => {
        if (e.delta > 6 || !onClick) return
        e.stopPropagation()
        onClick()
      }}
    >
      <spriteMaterial fog={false} depthWrite={false} transparent />
    </sprite>
  )
}

function setPointsOpacity(points: THREE.Points, opacity: number) {
  const mat = points.material
  if (mat instanceof THREE.PointsMaterial) mat.opacity = opacity
  points.visible = opacity > 0.01
}

export function Stars() {
  const ref = useRef<THREE.Points>(null)
  const geometry = useMemo(() => {
    const rand = mulberry32(3)
    const n = 900
    const arr = new Float32Array(n * 3)
    const v = new THREE.Vector3()
    for (let i = 0; i < n; i++) {
      v.set(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1).normalize().multiplyScalar(350)
      arr.set([v.x, v.y, v.z], i * 3)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3))
    return g
  }, [])
  useFrame(({ camera, clock }) => {
    const p = ref.current
    if (!p) return
    p.position.copy(camera.position)
    // The sky slowly wheels overhead (one turn per sidereal day).
    p.rotation.y = (env.time / 86164000) * Math.PI * 2
    setPointsOpacity(p, env.stars * (0.85 + Math.sin(clock.elapsedTime * 1.7) * 0.08))
  })
  return (
    <points ref={ref} geometry={geometry} renderOrder={-8}>
      <pointsMaterial color="#e6edff" size={1.4} sizeAttenuation={false} fog={false} depthWrite={false} transparent />
    </points>
  )
}

/** Key light keeps the sun's left/right and height, but always lights the visible face. */
function keyDirection(dir: THREE.Vector3, camera: THREE.Camera, out: THREE.Vector3) {
  out.set(dir.x, Math.max(dir.y, 0.12) + 0.25, 0.75).normalize()
  return toWorld(out, camera, out).multiplyScalar(50)
}

function syncLights(hemi: THREE.HemisphereLight, sun: THREE.DirectionalLight, moon: THREE.DirectionalLight, camera: THREE.Camera) {
  hemi.color.copy(env.colors.hemiSky)
  hemi.groundColor.copy(env.colors.hemiGround)
  hemi.intensity = env.hemi
  sun.color.copy(env.colors.sunColor)
  sun.intensity = env.sunIntensity
  keyDirection(env.sunDir, camera, sun.position)
  moon.color.copy(env.moonColor)
  moon.intensity = env.moonIntensity
  keyDirection(env.moonDir, camera, moon.position)
}

export function Lights() {
  const hemi = useRef<THREE.HemisphereLight>(null)
  const sun = useRef<THREE.DirectionalLight>(null)
  const moon = useRef<THREE.DirectionalLight>(null)
  useFrame(({ camera }) => {
    if (hemi.current && sun.current && moon.current) syncLights(hemi.current, sun.current, moon.current, camera)
  })
  return (
    <>
      <hemisphereLight ref={hemi} />
      <directionalLight ref={sun} />
      <directionalLight ref={moon} />
    </>
  )
}

function syncCloudMaterial(mat: THREE.MeshLambertMaterial) {
  mat.color.copy(env.colors.cloud)
}

const cloudPos = new THREE.Vector3()

/** Hide any cloud cluster that drifts between a close-up camera and its subject. */
function cullNearCamera(group: THREE.Group, camera: THREE.Camera) {
  for (const cluster of group.children) {
    cluster.getWorldPosition(cloudPos)
    cluster.visible = cloudPos.distanceTo(camera.position) > 9
  }
}

export function Clouds() {
  const group = useRef<THREE.Group>(null)
  const material = useMemo(() => ps1Material({ color: '#ffffff', transparent: true, opacity: 0.6, depthWrite: false }), [])
  const geo = useMemo(() => new THREE.IcosahedronGeometry(1, 1), [])
  const clusters = useMemo(() => {
    const rand = mulberry32(11)
    return Array.from({ length: 9 }, () => {
      const dir = new THREE.Vector3(rand() * 2 - 1, (rand() * 2 - 1) * 0.7, rand() * 2 - 1).normalize()
      const r = PLANET_RADIUS + 3.2 + rand() * 2
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)
      const puffs = Array.from({ length: 3 + Math.floor(rand() * 3) }, (_, i) => ({
        x: (i - 1.5) * 0.7 + rand() * 0.3,
        y: rand() * 0.25,
        z: (rand() - 0.5) * 0.6,
        s: 0.45 + rand() * 0.4,
      }))
      return { position: dir.multiplyScalar(r), quaternion: q, puffs }
    })
  }, [])
  useFrame(({ camera }, dt) => {
    const g = group.current
    if (g) {
      g.rotation.y += dt * 0.02
      cullNearCamera(g, camera)
    }
    syncCloudMaterial(material)
  })
  return (
    <group ref={group}>
      {clusters.map((c, i) => (
        <group key={i} position={c.position} quaternion={c.quaternion}>
          {c.puffs.map((p, j) => (
            <mesh key={j} geometry={geo} material={material} position={[p.x, p.y, p.z]} scale={[p.s, p.s * 0.55, p.s]} renderOrder={3} />
          ))}
        </group>
      ))}
    </group>
  )
}

export function Fireflies() {
  const points = useRef<THREE.Points>(null)
  const { geometry, seeds, base } = useMemo(() => {
    const rand = mulberry32(21)
    const n = 180
    const base = new Float32Array(n * 3)
    const seeds = new Float32Array(n)
    const v = new THREE.Vector3()
    for (let i = 0; i < n; i++) {
      v.set(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1).normalize()
      v.multiplyScalar(PLANET_RADIUS + 0.6 + rand() * 2.2)
      base.set([v.x, v.y, v.z], i * 3)
      seeds[i] = rand() * 100
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(base.slice(), 3))
    return { geometry: g, seeds, base }
  }, [])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const pos = geometry.getAttribute('position')
    for (let i = 0; i < seeds.length; i++) {
      const s = seeds[i]
      pos.setXYZ(
        i,
        base[i * 3] + Math.sin(t * 0.5 + s) * 0.25,
        base[i * 3 + 1] + Math.sin(t * 0.7 + s * 1.3) * 0.25,
        base[i * 3 + 2] + Math.cos(t * 0.4 + s * 0.7) * 0.25,
      )
    }
    pos.needsUpdate = true
    const p = points.current
    if (!p) return
    p.rotation.y = t * 0.01
    // Faint dust motes by day, fireflies by night.
    setPointsOpacity(p, 0.2 + env.night * 0.75)
  })
  return (
    <points ref={points} geometry={geometry}>
      <pointsMaterial
        map={getTextures().glow}
        color={ART.particles}
        size={0.35}
        transparent
        opacity={0.9}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  )
}
