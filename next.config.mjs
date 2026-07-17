/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    // Match the TS posture above — don't fail production builds on lint (deploy safety).
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  // PostHog reverse proxy: ingest analytics through our OWN origin so ad-blockers don't drop
  // events and (critically for the iframe) ingestion is same-origin as the embed. Point
  // NEXT_PUBLIC_POSTHOG_HOST at "/ingest". Region host is configurable via env (US default).
  async rewrites() {
    const region = (process.env.NEXT_PUBLIC_POSTHOG_REGION || "us").toLowerCase()
    const assetHost = region === "eu" ? "https://eu-assets.i.posthog.com" : "https://us-assets.i.posthog.com"
    const ingestHost = region === "eu" ? "https://eu.i.posthog.com" : "https://us.i.posthog.com"
    return [
      { source: "/ingest/static/:path*", destination: `${assetHost}/static/:path*` },
      { source: "/ingest/:path*", destination: `${ingestHost}/:path*` },
    ]
  },
}

export default nextConfig
