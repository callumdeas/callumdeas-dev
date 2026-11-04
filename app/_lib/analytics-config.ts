/**
 * PostHog settings. The project key is a *public* client key (phc_…), so it lives
 * in source rather than a NEXT_PUBLIC_ env var (scripts/cf-build.mjs refuses those).
 *
 * Leave POSTHOG_KEY empty to keep tracking off: track() becomes a no-op, and under
 * ?debug every event is still logged to the console.
 */
export const POSTHOG_KEY = 'phc_vtV96cYP94FpmsnpAcrhw42Qdw7TVgbKmDhq5PPEdyxg'

/** Which PostHog cloud the project lives in. */
export const POSTHOG_REGION: 'eu' | 'us' = 'eu'

/** Same-origin path proxied to PostHog (see next.config.ts) so blockers don't drop events. */
export const POSTHOG_PROXY_PATH = '/ingest'

export const POSTHOG_HOSTS = {
  eu: { api: 'https://eu.i.posthog.com', assets: 'https://eu-assets.i.posthog.com', ui: 'https://eu.posthog.com' },
  us: { api: 'https://us.i.posthog.com', assets: 'https://us-assets.i.posthog.com', ui: 'https://us.posthog.com' },
} as const
