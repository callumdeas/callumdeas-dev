'use client'

import { useEffect } from 'react'
import { initAnalytics, track } from './analytics'

/** Starts analytics and records which version of the site the visitor got. */
export function AnalyticsInit() {
  useEffect(() => {
    initAnalytics()
    const asked = /[?&]text(=|&|$)/.test(window.location.search)
    if (asked) track('text_version_opened', { via: 'url' })
    else if (document.documentElement.dataset.world !== 'on') track('world_unsupported')

    // Outbound links anywhere on the page (planet panels and the text version alike).
    const onClick = (e: MouseEvent) => {
      const a = e.target instanceof Element ? e.target.closest('a[href]') : null
      if (!(a instanceof HTMLAnchorElement)) return
      if (a.origin === window.location.origin && !a.href.startsWith('mailto:')) return
      track('link_clicked', { href: a.href, label: (a.textContent ?? '').trim().slice(0, 60) })
    }
    document.addEventListener('click', onClick, { capture: true })
    return () => document.removeEventListener('click', onClick, { capture: true })
  }, [])
  return null
}
