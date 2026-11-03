import type { PostHog } from 'posthog-js'
import { POSTHOG_HOSTS, POSTHOG_KEY, POSTHOG_PROXY_PATH, POSTHOG_REGION } from './analytics-config'

/**
 * Tiny analytics wrapper. Call track() from anywhere on the client; events queue
 * until PostHog has loaded (it's imported lazily so it never delays the boot).
 *
 * Cookieless by design: persistence is in memory only, so no consent banner is
 * needed under PECR. The trade-off: a returning visitor counts as a new person.
 */

export type EventProps = Record<string, string | number | boolean | null>

/** Every event the site sends, in one place. */
export type EventName =
  | 'world_ready'
  | 'world_unsupported'
  | 'text_version_opened'
  | 'place_opened'
  | 'link_clicked'
  | 'explore_started'
  | 'explore_stopped'
  | 'sound_toggled'
  | 'secret_found'
  | 'enquiry_opened'
  | 'enquiry_sent'
  | 'enquiry_failed'

const queue: { event: EventName; props: EventProps }[] = []
let client: PostHog | null = null
let loading = false
const superProps: EventProps = {}

function debugOn() {
  try {
    return new URLSearchParams(window.location.search).has('debug')
  } catch {
    return false
  }
}

export function initAnalytics() {
  if (typeof window === 'undefined' || loading || !POSTHOG_KEY) return
  loading = true
  void import('posthog-js').then(({ default: posthog }) => {
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_PROXY_PATH,
      ui_host: POSTHOG_HOSTS[POSTHOG_REGION].ui,
      persistence: 'memory',
      autocapture: false,
      capture_pageview: true,
      capture_pageleave: true,
      disable_session_recording: true,
      person_profiles: 'identified_only',
    })
    posthog.register(superProps)
    client = posthog
    for (const { event, props } of queue.splice(0)) posthog.capture(event, props)
  })
}

export function track(event: EventName, props: EventProps = {}) {
  if (typeof window === 'undefined') return
  if (debugOn()) console.info('[analytics]', event, props)
  if (!POSTHOG_KEY) return
  if (client) client.capture(event, props)
  else queue.push({ event, props })
}

/** Properties attached to every later event (e.g. season, weather). */
export function setContext(props: EventProps) {
  Object.assign(superProps, props)
  if (debugOn()) console.info('[analytics] context', props)
  client?.register(props)
}
