# callumdeas.dev

Callum Deas's portfolio: a tiny low-poly planet rendered like a PS1 game. Each project is a building you can visit; there's a walkable avatar, a real-time day/night sky, and a plain-text version for everyone else.

Next.js + React Three Fiber, deployed on Cloudflare Workers via OpenNext.

## Development

```bash
pnpm install
pnpm dev            # http://localhost:4317
```

Append `?debug` for review tools: `T` time panel (scrub, fast-forward, jump to festivals and seasons, override the weather), `[` `]` ±1 hour, `,` `.` ±1 month, `R` render resolution, `C` scanlines, `H` hide UI. `?text` forces the text version. `?weather=rain` (clear, cloudy, overcast, fog, drizzle, rain, snow, storm) forces the weather. Under `?debug` every analytics event is logged to the console.

## How it's put together

- `app/page.tsx` renders the server-side text version (`app/_planet/StaticSite.tsx`), a boot screen, and the planet (`app/_planet/WorldLoader.tsx` → `Experience.tsx`, client-only). A tiny head script in `app/layout.tsx` decides before first paint whether WebGL is available.
- `app/_planet/_lib/projects.ts`: all copy for the panels and the text version.
- `app/_planet/_lib/ps1.ts`: PS1 look (vertex snapping, affine texture warp) and the dither/quantise post pass; `_world/Pipeline.tsx` renders at 480p and upscales.
- `app/_planet/_lib/sky.ts` + `environment.ts`: real sun/moon positions and moon phase for the visitor's time and (timezone-estimated) location; lighting is keyed to sun elevation.
- `app/_planet/_world/CameraRig.tsx`: the planet spins under a fixed camera (free drag, flights to each place, explore mode follow).
- `app/_planet/_lib/seasons.ts` + `_world/Seasonal.tsx`: seasons (by hemisphere) and festivals: Halloween, Bonfire Night, Christmas, Hogmanay, Callum's birthday (26 Apr) and anniversary (25 May), with fireworks after dark.
- `app/api/weather` + `_lib/weather.ts` + `_world/Weather.tsx`: live weather at the visitor's coarse location (Cloudflare geo → Open-Meteo, no key) drives cloud, fog, rain, snow and storms.
- `app/api/enquiry` + `app/_lib/EnquiryForm.tsx`: the Post Office contact form, sent with Resend (see Secrets).
- `app/_lib/analytics.ts`: PostHog, cookieless, lazy-loaded, proxied through `/ingest`. Off until `POSTHOG_KEY` is set in `app/_lib/analytics-config.ts`.
- `app/_planet/_lib/sound.ts`: all audio is synthesised with Web Audio; muted by default.

## 3D assets (Blender)

Both are scripted and built headlessly. Edit the Python, then rebuild:

```bash
pnpm assets:avatar      # scripts/blender/avatar.py → public/models/avatar.glb (+ avatar-cap.glb)
pnpm assets:landmarks   # scripts/blender/landmarks.py → public/models/landmarks.glb
```

Requires Blender 4.5 at `/Applications/Blender.app`. Landmark materials are named in Blender and mapped to the site's PS1 materials at runtime (`_world/Landmarks.tsx`); empties named `glow_*`, `smoke_*`, `anchor_knot` and `spin_*` mark runtime effects.

## Secrets

- `RESEND_API_KEY`: `wrangler secret put RESEND_API_KEY`. callumdeas.dev must be a verified sending domain in Resend (letters come from `post@callumdeas.dev`). For `pnpm preview`, put it in `.dev.vars` (git-ignored). Without it, the form offers a prefilled email instead.

## Deploy

```bash
pnpm preview     # build and serve the Worker locally
pnpm deploy:cf   # build and deploy
```
