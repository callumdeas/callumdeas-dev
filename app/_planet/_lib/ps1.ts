import * as THREE from 'three'

/**
 * Uniforms shared by every PS1 material. Snap resolution tracks the low-res
 * render target so vertices wobble on the same grid the image is drawn on.
 */
export const ps1Uniforms = {
  uSnapRes: { value: new THREE.Vector2(320, 240) },
  uTime: { value: 0 },
}

export type PS1MaterialOptions = {
  color?: THREE.ColorRepresentation
  map?: THREE.Texture | null
  vertexColors?: boolean
  emissive?: THREE.ColorRepresentation
  emissiveIntensity?: number
  emissiveMap?: THREE.Texture | null
  transparent?: boolean
  opacity?: number
  side?: THREE.Side
  /** Animated vertex wobble amplitude along the normal (water). */
  wobble?: number
  fog?: boolean
  depthWrite?: boolean
}

/**
 * Lambert material patched to behave like PS1 hardware:
 * - vertex positions snapped to the low-res pixel grid (the "jitter")
 * - affine (non perspective-correct) texture mapping (the "warp")
 */
export function ps1Material(opts: PS1MaterialOptions = {}): THREE.MeshLambertMaterial {
  const mat = new THREE.MeshLambertMaterial({
    color: opts.color ?? 0xffffff,
    map: opts.map ?? null,
    vertexColors: opts.vertexColors ?? false,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 1,
    emissiveMap: opts.emissiveMap ?? null,
    flatShading: true,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
    side: opts.side ?? THREE.FrontSide,
    fog: opts.fog ?? true,
    depthWrite: opts.depthWrite ?? true,
  })
  const wobble = opts.wobble ?? 0

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uSnapRes = ps1Uniforms.uSnapRes
    shader.uniforms.uTime = ps1Uniforms.uTime

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
uniform vec2 uSnapRes;
uniform float uTime;
varying float vAffineW;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
${
  wobble > 0
    ? `transformed += normal * ${wobble.toFixed(4)} * sin(uTime * 1.4 + position.x * 1.3 + position.z * 0.9 + position.y * 1.1);`
    : ''
}`,
      )
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
{
  vec4 snapped = gl_Position;
  snapped.xyz /= snapped.w;
  snapped.xy = floor(snapped.xy * uSnapRes * 0.5 + 0.5) / (uSnapRes * 0.5);
  snapped.xyz *= snapped.w;
  gl_Position = snapped;
}
vAffineW = gl_Position.w;
#ifdef USE_MAP
  vMapUv *= gl_Position.w;
#endif`,
      )

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vAffineW;')
      .replace(
        '#include <map_fragment>',
        `#ifdef USE_MAP
  vec4 sampledDiffuseColor = texture2D( map, vMapUv / vAffineW );
  diffuseColor *= sampledDiffuseColor;
#endif`,
      )
  }
  mat.customProgramCacheKey = () => `ps1-${wobble}`
  return mat
}

/**
 * Fullscreen pass: sample the low-res target with nearest filtering, encode
 * to sRGB, then quantise with a 4x4 ordered (Bayer) dither in low-res pixel space.
 */
export function createPostMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    uniforms: {
      tDiffuse: { value: null },
      uRes: { value: new THREE.Vector2(320, 240) },
      uLevels: { value: 32 },
      uDither: { value: 1 },
      uVignette: { value: 0.35 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D tDiffuse;
      uniform vec2 uRes;
      uniform float uLevels;
      uniform float uDither;
      uniform float uVignette;
      varying vec2 vUv;

      float bayer2(vec2 a) {
        a = floor(a);
        return fract(dot(a, vec2(0.5, a.y * 0.75)));
      }
      float bayer4(vec2 a) {
        return bayer2(0.5 * a) * 0.25 + bayer2(a);
      }
      vec3 toSRGB(vec3 c) {
        c = clamp(c, 0.0, 1.0);
        return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
      }

      void main() {
        vec2 px = floor(vUv * uRes);
        vec2 uv = (px + 0.5) / uRes;
        vec3 c = toSRGB(texture2D(tDiffuse, uv).rgb);

        vec2 q = uv - 0.5;
        c *= 1.0 - uVignette * dot(q, q) * 1.6;

        float d = (bayer4(px) - 0.5) * uDither;
        c = floor(c * (uLevels - 1.0) + 0.5 + d) / (uLevels - 1.0);
        gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
      }
    `,
  })
}
