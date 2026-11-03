import * as THREE from 'three'
import { ART } from './art'
import { ps1Material } from './ps1'
import {
  brickTexture,
  glowTexture,
  grainTexture,
  plankTexture,
  plasterTexture,
  shingleTexture,
  signTexture,
  stripeTexture,
} from './textures'

type Textures = {
  grain: THREE.Texture
  plaster: THREE.Texture
  planks: THREE.Texture
  brick: THREE.Texture
  shingle: THREE.Texture
  glow: THREE.Texture
  arcadeSign: THREE.Texture
  dishSign: THREE.Texture
  awnings: THREE.Texture[]
  shopSigns: THREE.Texture[]
  scoreboard: THREE.Texture
}

let cached: Textures | null = null

/** Textures are preset-independent; build them once on the client. */
export function getTextures(): Textures {
  if (cached) return cached
  const grain = grainTexture()
  grain.repeat.set(6, 6)
  cached = {
    grain,
    plaster: plasterTexture(),
    planks: plankTexture(),
    brick: brickTexture(),
    shingle: shingleTexture(),
    glow: glowTexture(),
    arcadeSign: signTexture('NAME GAME', '#fff4fb', '#d42c8c', 64, 16),
    dishSign: signTexture('DISH', '#3a2418', '#f2e2c4', 32, 12),
    awnings: [stripeTexture('#f6efe8', '#c97a8a'), stripeTexture('#f6efe8', '#c9a25a'), stripeTexture('#f6efe8', '#8a6fb0')],
    shopSigns: SHOP_NAMES.map((name) => signTexture(name, '#f6e7d0', '#2b2230', 160, 20)),
    scoreboard: signTexture('HOME 2-1 AWAY', '#ffd36a', '#0c1016', 96, 24),
  }
  return cached
}

export const FACADES: readonly string[] = ['#efcfcf', '#ece3d3', '#d6c8e6']

/** High Street sign boards, in shop order (left to right). */
export const SHOP_NAMES: readonly string[] = ['THE BRIDAL ETIQUETTE', 'BROOKE LILIAS', 'BROOKLYN BRIDAL']

export function makePalette() {
  const t = getTextures()
  return {
    plaster: ps1Material({ color: '#f3ebe6', map: t.plaster }),
    cream: ps1Material({ color: '#f1e2c2', map: t.plaster }),
    stone: ps1Material({ color: '#b3acbb', map: t.brick }),
    brick: ps1Material({ color: '#b86a52', map: t.brick }),
    wood: ps1Material({ color: '#a77650', map: t.planks }),
    woodDark: ps1Material({ color: '#5c3d2e', map: t.planks }),
    roofRed: ps1Material({ color: '#a9473f', map: t.shingle }),
    roofSlate: ps1Material({ color: '#525a78', map: t.shingle }),
    roofTeal: ps1Material({ color: '#3f7c78', map: t.shingle }),
    dark: ps1Material({ color: '#25222c' }),
    metal: ps1Material({ color: '#8c93a3' }),
    silo: ps1Material({ color: '#c9c4b8', map: t.planks }),
    white: ps1Material({ color: '#f6f2ec' }),
    gold: ps1Material({ color: '#e0b04f', emissive: '#5a3a0c', emissiveIntensity: 0.6 }),
    window: ps1Material({ color: '#2c3550', emissive: ART.windowGlow, emissiveIntensity: 1.5 }),
    lamp: ps1Material({ color: '#3a3440', emissive: ART.lampGlow, emissiveIntensity: 2.2 }),
    neonPink: ps1Material({ color: '#000000', emissive: '#ff4fb8', emissiveIntensity: 2.2 }),
    neonCyan: ps1Material({ color: '#000000', emissive: '#4ff0ff', emissiveIntensity: 2.2 }),
    screen: ps1Material({ color: '#000000', emissive: '#7cf0b0', emissiveIntensity: 1.6 }),
    arcadeWall: ps1Material({ color: '#4a3470', map: t.brick }),
    arcadeSign: ps1Material({ color: '#000000', emissive: '#ffffff', emissiveMap: t.arcadeSign, emissiveIntensity: 1.6 }),
    dishSign: ps1Material({ color: '#ffffff', map: t.dishSign }),
    flowerPink: ps1Material({ color: '#f29ab8' }),
    flowerWhite: ps1Material({ color: '#fff6f0' }),
    leaf: ps1Material({ color: ART.foliage[0] }),
    crop: ps1Material({ color: '#86ad4f' }),
    hay: ps1Material({ color: '#d9b45a', map: t.planks }),
    pitch: ps1Material({ color: '#4f8f45', map: t.grain }),
    pitchStripe: ps1Material({ color: '#5fa052', map: t.grain }),
    seatBlue: ps1Material({ color: '#3a6fb0', map: t.planks }),
    seatWhite: ps1Material({ color: '#e8ecf2', map: t.planks }),
    scoreboard: ps1Material({ color: '#000000', emissive: '#ffffff', emissiveMap: t.scoreboard, emissiveIntensity: 1.2 }),
    shopSigns: t.shopSigns.map((map) => ps1Material({ color: '#ffffff', map, emissive: '#ffffff', emissiveMap: map, emissiveIntensity: 0 })),
    soil: ps1Material({ color: '#5a3d2c' }),
    pumpkin: ps1Material({ color: '#e5782c' }),
    awnings: t.awnings.map((map) => ps1Material({ map })),
    facades: FACADES.map((color) => ps1Material({ color, map: t.plaster })),
    // Avatar (placeholder for the Blender-built one)
    jacket: ps1Material({ color: '#c8571f' }),
    beanie: ps1Material({ color: '#d0612a' }),
    skin: ps1Material({ color: '#d9a07c' }),
    beard: ps1Material({ color: '#2a1d18' }),
    jeans: ps1Material({ color: '#2b2b30' }),
    hoodie: ps1Material({ color: '#b9b5ae' }),
    glasses: ps1Material({ color: '#e8eef2', transparent: true, opacity: 0.55 }),
  }
}

export type Palette = ReturnType<typeof makePalette>

export function disposePalette(palette: Palette) {
  for (const value of Object.values(palette)) {
    if (Array.isArray(value)) value.forEach((m) => m.dispose())
    else value.dispose()
  }
}
