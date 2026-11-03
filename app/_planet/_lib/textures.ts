import * as THREE from 'three'
import { mulberry32 } from './noise'

type Draw = (ctx: CanvasRenderingContext2D, rand: () => number, w: number, h: number) => void

function canvasTexture(w: number, h: number, draw: Draw, seed = 1, smooth = false): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D canvas context unavailable')
  ctx.imageSmoothingEnabled = false
  draw(ctx, mulberry32(seed), w, h)
  const tex = new THREE.CanvasTexture(canvas)
  tex.magFilter = smooth ? THREE.LinearFilter : THREE.NearestFilter
  tex.minFilter = smooth ? THREE.LinearFilter : THREE.NearestFilter
  tex.generateMipmaps = false
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

const grey = (v: number) => `rgb(${v},${v},${v})`

/** Neutral speckle; multiplies with vertex colours for crunchy terrain. */
export const grainTexture = () =>
  canvasTexture(32, 32, (ctx, r, w, h) => {
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        ctx.fillStyle = grey(Math.round(205 + r() * 50))
        ctx.fillRect(x, y, 1, 1)
      }
  })

export const plasterTexture = () =>
  canvasTexture(32, 32, (ctx, r, w, h) => {
    ctx.fillStyle = grey(236)
    ctx.fillRect(0, 0, w, h)
    for (let i = 0; i < 90; i++) {
      ctx.fillStyle = grey(Math.round(200 + r() * 40))
      ctx.fillRect(Math.floor(r() * w), Math.floor(r() * h), 1 + Math.floor(r() * 2), 1)
    }
  }, 2)

export const plankTexture = () =>
  canvasTexture(32, 32, (ctx, r, w, h) => {
    for (let y = 0; y < h; y += 4) {
      const base = Math.round(180 + r() * 50)
      ctx.fillStyle = grey(base)
      ctx.fillRect(0, y, w, 4)
      ctx.fillStyle = grey(base - 70)
      ctx.fillRect(0, y + 3, w, 1)
      ctx.fillRect(Math.floor(r() * w), y, 1, 3)
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = grey(base - 25)
        ctx.fillRect(Math.floor(r() * w), y + 1, 2 + Math.floor(r() * 4), 1)
      }
    }
  }, 3)

export const brickTexture = () =>
  canvasTexture(32, 32, (ctx, r, w, h) => {
    ctx.fillStyle = grey(150)
    ctx.fillRect(0, 0, w, h)
    for (let row = 0; row < h / 4; row++) {
      const off = row % 2 === 0 ? 0 : 4
      for (let x = -8; x < w; x += 8) {
        ctx.fillStyle = grey(Math.round(200 + r() * 55))
        ctx.fillRect(x + off, row * 4, 7, 3)
      }
    }
  }, 4)

export const shingleTexture = () =>
  canvasTexture(32, 32, (ctx, r, w, h) => {
    for (let row = 0; row < h / 4; row++) {
      const off = row % 2 === 0 ? 0 : 3
      for (let x = -6; x < w; x += 6) {
        const v = Math.round(185 + r() * 60)
        ctx.fillStyle = grey(v)
        ctx.fillRect(x + off, row * 4, 5, 4)
        ctx.fillStyle = grey(v - 80)
        ctx.fillRect(x + off, row * 4 + 3, 6, 1)
      }
    }
  }, 5)

export const stripeTexture = (a: string, b: string) =>
  canvasTexture(16, 16, (ctx, _r, w, h) => {
    for (let x = 0; x < w; x += 4) {
      ctx.fillStyle = (x / 4) % 2 === 0 ? a : b
      ctx.fillRect(x, 0, 4, h)
    }
  })

export const signTexture = (text: string, fg: string, bg: string, w = 64, h = 16) =>
  canvasTexture(w, h, (ctx) => {
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = fg
    let size = Math.floor(h * 0.75)
    ctx.font = `bold ${size}px monospace`
    while (size > 6 && ctx.measureText(text).width > w - 6) {
      size -= 1
      ctx.font = `bold ${size}px monospace`
    }
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, w / 2, h / 2 + 1)
  })

/** Soft radial falloff for additive glow sprites. */
export const glowTexture = () =>
  canvasTexture(
    64,
    64,
    (ctx, _r, w, h) => {
      const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2)
      g.addColorStop(0, 'rgba(255,255,255,1)')
      g.addColorStop(0.25, 'rgba(255,255,255,0.55)')
      g.addColorStop(0.6, 'rgba(255,255,255,0.12)')
      g.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h)
    },
    1,
    true,
  )

export const sunTexture = () =>
  canvasTexture(64, 64, (ctx, _r, w, h) => {
    const cx = w / 2
    const cy = h / 2
    const halo = ctx.createRadialGradient(cx, cy, w * 0.12, cx, cy, w / 2)
    halo.addColorStop(0, 'rgba(255,255,255,0.5)')
    halo.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = halo
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(cx, cy, w * 0.16, 0, Math.PI * 2)
    ctx.fill()
  })

/**
 * Moon disc lit for a given sun→moon elongation (0 new, 180 full), with
 * faint earthshine on the dark side. Shaded per pixel as a sphere.
 */
export const moonTexture = (phaseAngle: number) =>
  canvasTexture(48, 48, (ctx, r, w, h) => {
    const a = (phaseAngle * Math.PI) / 180
    const lx = Math.sin(a)
    const lz = -Math.cos(a)
    const R = w * 0.3
    const cx = w / 2
    const cy = h / 2
    const halo = ctx.createRadialGradient(cx, cy, R * 0.8, cx, cy, w / 2)
    halo.addColorStop(0, `rgba(255,255,255,${0.25 * Math.max(0.15, (1 - Math.cos(a)) / 2)})`)
    halo.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = halo
    ctx.fillRect(0, 0, w, h)
    const craters = Array.from({ length: 7 }, () => ({ x: (r() - 0.5) * 1.2, y: (r() - 0.5) * 1.2, s: 0.08 + r() * 0.14 }))
    for (let py = 0; py < h; py++)
      for (let px = 0; px < w; px++) {
        const x = (px + 0.5 - cx) / R
        const y = (py + 0.5 - cy) / R
        const d2 = x * x + y * y
        if (d2 > 1) continue
        const z = Math.sqrt(1 - d2)
        const lit = x * lx + z * lz > 0
        const crater = craters.some((c) => (x - c.x) ** 2 + (y - c.y) ** 2 < c.s * c.s)
        const v = lit ? (crater ? 200 : 245) : crater ? 40 : 52
        ctx.fillStyle = `rgba(${v},${v},${v + 8},${lit ? 1 : 0.55})`
        ctx.fillRect(px, py, 1, 1)
      }
  }, 9)

/** Chunky down-pointing POI arrow (white, dark outline) for landmark markers. */
export const markerTexture = () =>
  canvasTexture(16, 16, (ctx) => {
    const rows = [
      '..XXXXXXXXXXXX..',
      '..XWWWWWWWWWWX..',
      '..XWWWWWWWWWWX..',
      '...XWWWWWWWWX...',
      '...XWWWWWWWWX...',
      '....XWWWWWWX....',
      '....XWWWWWWX....',
      '.....XWWWWX.....',
      '.....XWWWWX.....',
      '......XWWX......',
      '......XWWX......',
      '.......XX.......',
    ]
    rows.forEach((row, y) =>
      [...row].forEach((ch, x) => {
        if (ch === '.') return
        ctx.fillStyle = ch === 'X' ? '#1a1424' : '#ffffff'
        ctx.fillRect(x, y + 2, 1, 1)
      }),
    )
  })
