'use client'

import { useEffect } from 'react'
import { initAnalytics, track } from './analytics'

/** Where a link goes, without query or hash: a mailto: link can carry a whole letter. */
function safeHref(a: HTMLAnchorElement) {
  if (a.protocol === 'mailto:') return 'mailto'
  return `${a.origin}${a.pathname}`
}

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
      track('link_clicked', { href: safeHref(a), label: (a.textContent ?? '').trim().slice(0, 60) })
    }
    document.addEventListener('click', onClick, { capture: true })
    return () => document.removeEventListener('click', onClick, { capture: true })
  }, [])
  return null
}
