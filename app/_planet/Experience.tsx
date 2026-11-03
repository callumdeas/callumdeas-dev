'use client'

import { Canvas, useFrame } from '@react-three/fiber'
import { Suspense, startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ART } from './_lib/art'
import { clock, goLive, initEnvironment, setSimTime, setSpeed, simNow } from './_lib/environment'
import { clearInput, isMoveKey, pressKey } from './_lib/input'
import type { LandmarkId } from './_lib/planet'
import { PROJECTS, projectById } from './_lib/projects'
import { sameSelection, type Selection } from './_lib/selection'
import { Clouds, EnvironmentDriver, Fireflies, Lights, Moon, Sky, Stars, Sun } from './_world/Atmosphere'
import { Avatar, avatarControl, type Outfit } from './_world/Avatar'
import { HiddenCat, ShootingStars, shootingStars } from './_world/Secrets'
import { sound } from './_lib/sound'
import { env } from './_lib/environment'
import { CameraRig, type RigMode } from './_world/CameraRig'
import { ExploreController } from './_world/Explore'
import { FovFit } from './_world/FovFit'
import { InteractionContext, type HoverTarget } from './_world/interaction'
import { Landmarks } from './_world/Landmarks'
import { PS1Pipeline } from './_world/Pipeline'
import { Lamps, Ocean, Planet, Rocks, Trees } from './_world/Terrain'
import { InfoPanel } from './_ui/InfoPanel'
import { Joystick } from './_ui/Joystick'
import { Panel, RetroButton, pixelFont } from './_ui/retro'
import { ClockLine, DAY, MINUTE, SPEEDS, TimePanel } from './_ui/TimePanel'

// This module only ever loads in the browser (dynamic import, ssr: false).
initEnvironment()

const RESOLUTIONS: readonly number[] = [480, 360, 240]
const DEBUG = new URLSearchParams(window.location.search).has('debug')

/** Tour order for PREV / NEXT: about first, then each place. */
const TOUR: readonly Exclude<Selection, null>[] = [
  { kind: 'avatar' },
  ...PROJECTS.map((p): Exclude<Selection, null> => ({ kind: 'landmark', id: p.id })),
]

function useMedia(query: string) {
  const [match, setMatch] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const on = () => setMatch(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [query])
  return match
}

const KONAMI = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown', 'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a']

function requestShootingStar() {
  shootingStars.requested += 1
}

const DESKTOP_SHIFT = { x: 0.17, y: 0 }
const MOBILE_SHIFT = { x: 0, y: -0.3 }

/** Tells the loader the world has rendered a few frames (after the avatar loads). */
function ReadySignal({ onReady }: { onReady: () => void }) {
  const frames = useRef(0)
  const done = useRef(false)
  useFrame(() => {
    frames.current += 1
    if (!done.current && frames.current > 3) {
      done.current = true
      onReady()
    }
  })
  return null
}

export default function Experience({ onReady, onTextVersion }: { onReady: () => void; onTextVersion: () => void }) {
  const [resIndex, setResIndex] = useState(0)
  const [scanlines, setScanlines] = useState(true)
  const [hud, setHud] = useState(true)
  const [timeTools, setTimeTools] = useState(false)
  const [selection, setSelection] = useState<Selection>(null)
  const [hovered, setHovered] = useState<HoverTarget>(null)
  const [mode, setMode] = useState<RigMode>('orbit')
  const [near, setNear] = useState<LandmarkId | null>(null)
  const [menu, setMenu] = useState(false)
  const [outfit, setOutfit] = useState<Outfit>('beanie')
  const [toast, setToast] = useState<string | null>(null)
  const [soundOn, setSoundOn] = useState(false)
  const konami = useRef<string[]>([])
  const desktop = useMedia('(min-width: 768px)')
  const touch = useMedia('(pointer: coarse)')
  const reducedMotion = useMedia('(prefers-reduced-motion: reduce)')
  const height = RESOLUTIONS[resIndex]
  const exploring = mode === 'explore'

  const select = useCallback((next: Selection) => {
    setSelection((prev) => (sameSelection(prev, next) ? prev : next))
  }, [])

  const step = useCallback((dir: 1 | -1) => {
    setSelection((prev) => {
      const i = TOUR.findIndex((t) => sameSelection(t, prev))
      return TOUR[(i + dir + TOUR.length) % TOUR.length]
    })
  }, [])

  const startExplore = useCallback(() => {
    setSelection(null)
    setMode('explore')
  }, [])
  const stopExplore = useCallback(() => {
    clearInput()
    setMode('orbit')
    setNear(null)
  }, [])

  useEffect(() => {
    avatarControl.exploring = exploring
  }, [exploring])

  const showToast = useCallback((text: string) => {
    setToast(text)
    sound.chime()
  }, [])
  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(null), 3600)
    return () => window.clearTimeout(id)
  }, [toast])

  const toggleOutfit = useCallback(() => {
    const next: Outfit = outfit === 'beanie' ? 'cap' : 'beanie'
    // Transition: keep the current avatar (and the buildings) on screen while the new GLB loads.
    startTransition(() => setOutfit(next))
    showToast(next === 'cap' ? '★ SECRET OUTFIT UNLOCKED ★' : 'BACK IN THE BEANIE')
  }, [outfit, showToast])
  const foundCat = useCallback(() => showToast('YOU FOUND THE CAT! =^.^='), [showToast])
  const wish = useCallback(() => {
    requestShootingStar()
    showToast('✦ MAKE A WISH ✦')
  }, [showToast])

  // UI sounds follow the selection.
  const prevSelection = useRef<Selection>(null)
  useEffect(() => {
    if (selection && !sameSelection(selection, prevSelection.current)) sound.select()
    else if (!selection && prevSelection.current) sound.back()
    prevSelection.current = selection
  }, [selection])

  // Music mood follows the sky; resume saved "sound on" at the first gesture.
  useEffect(() => {
    const id = window.setInterval(() => sound.setNight(env.night), 1000)
    const resume = () => {
      if (sound.savedPreference() && !sound.enabled) void sound.enable().then(() => setSoundOn(true))
    }
    window.addEventListener('pointerdown', resume, { once: true })
    window.addEventListener('keydown', resume, { once: true })
    return () => {
      window.clearInterval(id)
      window.removeEventListener('pointerdown', resume)
      window.removeEventListener('keydown', resume)
    }
  }, [])

  const toggleSound = useCallback(() => {
    if (sound.enabled) {
      sound.disable()
      setSoundOn(false)
    } else {
      void sound.enable().then(() => setSoundOn(true))
    }
  }, [])

  const interaction = useMemo(() => ({ selection, hovered, setHovered, select }), [selection, hovered, select])

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      const k = e.key
      konami.current = [...konami.current, k.toLowerCase()].slice(-KONAMI.length)
      if (konami.current.join() === KONAMI.join()) {
        konami.current = []
        toggleOutfit()
      }
      if (k === 'Escape') {
        if (selection) setSelection(null)
        else if (exploring) stopExplore()
        return
      }
      if (exploring && !selection) {
        if (isMoveKey(k)) {
          e.preventDefault()
          pressKey(k, true)
          return
        }
        if ((k === 'e' || k === 'Enter') && near) {
          clearInput()
          select({ kind: 'landmark', id: near })
          return
        }
      }
      if (selection && k === 'ArrowRight') return step(1)
      if (selection && k === 'ArrowLeft') return step(-1)
      if (!exploring && !selection && (k === 'x' || k === 'X')) return startExplore()
      if (k === 'm' || k === 'M') return toggleSound()
      if (!DEBUG) return
      if (k === 'r') setResIndex((i) => (i + 1) % RESOLUTIONS.length)
      else if (k === 'c') setScanlines((v) => !v)
      else if (k === 'h') setHud((v) => !v)
      else if (k === 't') setTimeTools((v) => !v)
      else if (k === 'l') goLive()
      else if (k === 'f') setSpeed(SPEEDS[(SPEEDS.indexOf(clock.speed) + 1) % SPEEDS.length])
      else if (k === '[') setSimTime(simNow() - 60 * MINUTE)
      else if (k === ']') setSimTime(simNow() + 60 * MINUTE)
      else if (k === ',') setSimTime(simNow() - 30 * DAY)
      else if (k === '.') setSimTime(simNow() + 30 * DAY)
    }
    const onUp = (e: KeyboardEvent) => {
      if (isMoveKey(e.key)) pressKey(e.key, false)
    }
    const onBlur = () => clearInput()
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [selection, exploring, near, step, select, startExplore, stopExplore, toggleOutfit, toggleSound])

  const nearProject = near ? projectById(near) : null

  return (
    <div className="fixed inset-0 overflow-hidden select-none" style={{ background: '#14233a' }}>
      <Canvas
        dpr={1}
        flat
        gl={{ antialias: false, powerPreference: 'high-performance' }}
        camera={{ fov: 40, position: [9, 13, 36], near: 0.1, far: 1000 }}
        style={{ imageRendering: 'pixelated' }}
        onPointerMissed={() => setHovered(null)}
      >
        <InteractionContext.Provider value={interaction}>
          <EnvironmentDriver />
          <FovFit />
          <Sky />
          <Sun />
          <Moon onClick={wish} />
          <ShootingStars />
          <Stars />
          <Lights />
          <PS1Pipeline height={height} />
          <ExploreController active={exploring && selection === null} onNear={setNear} />
          <CameraRig
            selection={selection}
            mode={mode}
            panelShift={desktop ? DESKTOP_SHIFT : MOBILE_SHIFT}
            paused={hovered !== null}
            reducedMotion={reducedMotion}
          >
            <Planet />
            <Ocean />
            <Trees />
            <Rocks />
            <Lamps />
            <HiddenCat onFound={foundCat} />
            <Suspense fallback={null}>
              <Landmarks />
              <Suspense fallback={null}>
                <Avatar key={outfit} outfit={outfit} onSecretTaps={toggleOutfit} />
              </Suspense>
              <ReadySignal onReady={onReady} />
            </Suspense>
            <Clouds />
            <Fireflies />
          </CameraRig>
        </InteractionContext.Provider>
      </Canvas>

      {scanlines && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'repeating-linear-gradient(to bottom, rgba(0,0,0,0.14) 0px, rgba(0,0,0,0.14) 1px, transparent 1px, transparent 3px)',
            mixBlendMode: 'multiply',
          }}
        />
      )}

      {hud && (
        <div className="pointer-events-none absolute inset-0 p-4 text-white sm:p-6" style={pixelFont}>
          <Panel className="inline-block px-4 py-3">
            <button
              type="button"
              className="block cursor-pointer text-left"
              onClick={() => {
                stopExplore()
                select(null)
              }}
            >
              <div className="text-3xl leading-none tracking-wide sm:text-4xl" style={{ color: ART.accent }}>
                CALLUMDEAS.DEV
              </div>
            </button>
            <ClockLine />
            <button
              type="button"
              onClick={toggleSound}
              className="mt-2 cursor-pointer text-lg leading-none opacity-80 hover:opacity-100"
              aria-pressed={soundOn}
              title="Sound (M)"
            >
              {soundOn ? '♪ SOUND ON' : '♪ SOUND OFF'}
            </button>
          </Panel>

          {toast && (
            <div className="absolute inset-x-0 top-24 flex justify-center sm:top-8" role="status">
              <div
                className="retro-panel-in px-5 py-2 text-2xl leading-none"
                style={{ background: ART.accent, color: '#120e1c', boxShadow: '4px 4px 0 rgba(0,0,0,0.5)' }}
              >
                {toast}
              </div>
            </div>
          )}

          {!selection && !exploring && !desktop && (
            <button
              type="button"
              onClick={() => setMenu((v) => !v)}
              className="pointer-events-auto absolute top-4 right-4 cursor-pointer px-3 py-2 text-xl leading-none"
              style={{ background: 'rgba(12,10,24,0.84)', border: '2px solid rgba(255,255,255,0.88)' }}
              aria-expanded={menu}
            >
              {menu ? '✕' : '☰'} PLACES
            </button>
          )}

          {!selection && !exploring && (desktop || menu) && (
            <Panel className="absolute top-16 right-4 px-4 py-3 text-lg leading-tight sm:right-6 md:top-6">
              <div className="mb-1 text-base opacity-60">PLACES</div>
              {TOUR.map((t) => {
                const p = t.kind === 'landmark' ? PROJECTS.find((x) => x.id === t.id) : null
                const key = p ? p.id : 'avatar'
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setMenu(false)
                      select(t)
                    }}
                    onPointerEnter={() => setHovered(key)}
                    onPointerLeave={() => setHovered(null)}
                    className="flex w-full cursor-pointer gap-3 text-left hover:opacity-80"
                  >
                    <span style={{ color: hovered === key ? '#fff' : ART.accent }}>&#9656;</span>
                    <span className="w-32">{p ? p.place : 'Say hi'}</span>
                    <span className="opacity-70">{p ? p.name : 'About me'}</span>
                  </button>
                )
              })}
            </Panel>
          )}

          {!selection && !timeTools && (
            <div className="absolute inset-x-4 bottom-5 flex flex-col items-center gap-3 sm:bottom-6">
              {exploring && nearProject && (
                <button
                  type="button"
                  onClick={() => {
                    clearInput()
                    select({ kind: 'landmark', id: nearProject.id })
                  }}
                  className="pointer-events-auto cursor-pointer px-4 py-2 text-2xl leading-none"
                  style={{ background: ART.accent, color: '#120e1c', boxShadow: '4px 4px 0 rgba(0,0,0,0.5)' }}
                >
                  {touch ? 'TAP' : '[E]'} ENTER {nearProject.place.toUpperCase()}
                </button>
              )}
              <div className="flex flex-wrap items-center justify-center gap-3">
                {exploring ? (
                  <RetroButton onClick={stopExplore}>✕ EXIT EXPLORE</RetroButton>
                ) : (
                  <RetroButton onClick={startExplore} title="Explore on foot (X)">
                    ▶ EXPLORE ON FOOT
                  </RetroButton>
                )}
              </div>
              <div className="text-center text-lg leading-none sm:text-xl" style={{ textShadow: '2px 2px 0 rgba(0,0,0,0.7)' }}>
                {exploring
                  ? touch
                    ? 'DRAG THE STICK TO WALK'
                    : 'WASD / ARROWS TO WALK · ESC TO STOP'
                  : touch
                    ? 'TAP A BUILDING · DRAG TO SPIN'
                    : 'CLICK A BUILDING · DRAG TO SPIN THE PLANET'}
              </div>
            </div>
          )}

          {!selection && (
            <button
              type="button"
              onClick={onTextVersion}
              className="pointer-events-auto absolute right-4 bottom-4 hidden cursor-pointer text-base leading-none opacity-60 hover:opacity-100 sm:right-6 sm:bottom-6 md:block"
              style={{ textShadow: '2px 2px 0 rgba(0,0,0,0.7)' }}
            >
              TEXT VERSION
            </button>
          )}

          {exploring && !selection && touch && (
            <div className="absolute bottom-40 left-5">
              <Joystick />
            </div>
          )}

          {DEBUG && timeTools && !selection && (
            <div className="absolute inset-x-4 bottom-4 flex justify-center sm:inset-x-6 sm:bottom-6">
              <TimePanel />
            </div>
          )}

          {selection && (
            <InfoPanel
              selection={selection}
              onClose={() => select(null)}
              onStep={step}
              onSelect={select}
              reducedMotion={reducedMotion}
            />
          )}
        </div>
      )}
    </div>
  )
}
