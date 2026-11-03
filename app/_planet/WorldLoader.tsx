'use client'

import dynamic from 'next/dynamic'
import { useCallback, useSyncExternalStore } from 'react'
import { track } from '../_lib/analytics'

// three.js stays out of the server/Worker bundle entirely.
const Experience = dynamic(() => import('./Experience'), { ssr: false })

const MIN_BOOT_MS = 1400

function setWorld(on: boolean) {
  const el = document.documentElement
  if (on) el.dataset.world = 'on'
  else delete el.dataset.world
}

function setBooted() {
  document.documentElement.dataset.booted = '1'
}

function subscribeWorld(onChange: () => void) {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-world'] })
  return () => observer.disconnect()
}

const readWorld = () => document.documentElement.dataset.world === 'on'

/** Mounts the planet when the head script decided WebGL is available. */
export default function WorldLoader() {
  const enabled = useSyncExternalStore(subscribeWorld, readWorld, () => false)

  const onReady = useCallback(() => {
    track('world_ready', { ms: Math.round(performance.now()) })
    window.setTimeout(setBooted, Math.max(0, MIN_BOOT_MS - performance.now()))
  }, [])

  const onTextVersion = useCallback(() => {
    track('text_version_opened', { via: 'button' })
    setWorld(false)
    const url = new URL(window.location.href)
    url.searchParams.set('text', '')
    window.history.replaceState(null, '', url)
    window.scrollTo(0, 0)
  }, [])

  if (!enabled) return null
  return <Experience onReady={onReady} onTextVersion={onTextVersion} />
}
