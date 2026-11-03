import type { NextConfig } from "next";
import { POSTHOG_HOSTS, POSTHOG_PROXY_PATH, POSTHOG_REGION } from "./app/_lib/analytics-config";

const posthog = POSTHOG_HOSTS[POSTHOG_REGION];

const nextConfig: NextConfig = {
  // PostHog via our own origin, so ad blockers don't silently drop usage events.
  async rewrites() {
    return [
      { source: `${POSTHOG_PROXY_PATH}/static/:path*`, destination: `${posthog.assets}/static/:path*` },
      { source: `${POSTHOG_PROXY_PATH}/:path*`, destination: `${posthog.api}/:path*` },
    ];
  },
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
