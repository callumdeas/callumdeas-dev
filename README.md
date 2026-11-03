# callumdeas.dev

Callum Deas's portfolio: a tiny low-poly planet rendered like a PS1 game. Each project is a building you can visit; there's a walkable avatar, a real-time day/night sky, and a plain-text version for everyone else.

Next.js + React Three Fiber, deployed on Cloudflare Workers via OpenNext.

## Development

```bash
pnpm install
pnpm dev            # http://localhost:4317
```

Append `?debug` for review tools: `T` time panel (scrub, fast-forward, seasons), `[` `]` ±1 hour, `,` `.` ±1 month, `R` render resolution, `C` scanlines, `H` hide UI. `?text` forces the text version.

## How it's put together

- `app/page.tsx` renders the server-side text version (`app/_planet/StaticSite.tsx`), a boot screen, and the planet (`app/_planet/WorldLoader.tsx` → `Experience.tsx`, client-only). A tiny head script in `app/layout.tsx` decides before first paint whether WebGL is available.
- `app/_planet/_lib/projects.ts`: all copy for the panels and the text version.
- `app/_planet/_lib/ps1.ts`: PS1 look (vertex snapping, affine texture warp) and the dither/quantise post pass; `_world/Pipeline.tsx` renders at 480p and upscales.
- `app/_planet/_lib/sky.ts` + `environment.ts`: real sun/moon positions and moon phase for the visitor's time and (timezone-estimated) location; lighting is keyed to sun elevation.
- `app/_planet/_world/CameraRig.tsx`: the planet spins under a fixed camera (free drag, flights to each place, explore mode follow).
- `app/_planet/_lib/sound.ts`: all audio is synthesised with Web Audio; muted by default.

## 3D assets (Blender)

Both are scripted and built headlessly. Edit the Python, then rebuild:

```bash
pnpm assets:avatar      # scripts/blender/avatar.py → public/models/avatar.glb (+ avatar-cap.glb)
pnpm assets:landmarks   # scripts/blender/landmarks.py → public/models/landmarks.glb
```

Requires Blender 4.5 at `/Applications/Blender.app`. Landmark materials are named in Blender and mapped to the site's PS1 materials at runtime (`_world/Landmarks.tsx`); empties named `glow_*`, `smoke_*`, `anchor_knot` and `spin_*` mark runtime effects.

## Deploy

```bash
pnpm preview     # build and serve the Worker locally
pnpm deploy:cf   # build and deploy
```
