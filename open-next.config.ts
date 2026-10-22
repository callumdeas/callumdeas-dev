import { defineCloudflareConfig } from '@opennextjs/cloudflare'
import staticAssetsIncrementalCache from '@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache'

// OpenNext adapter config for Cloudflare Workers (see wrangler.jsonc).
//
// The site is fully static (one prerendered page), so the read-only
// static-assets incremental cache serves the build's prerendered HTML straight
// from Workers static assets — no R2/KV resource needed.
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
  enableCacheInterception: true,
})
