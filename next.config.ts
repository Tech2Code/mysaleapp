import type { NextConfig } from "next"

const supabaseHost = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname
  } catch {
    return undefined
  }
})()

const isDev = process.env.NODE_ENV !== "production"
const supabaseOrigin = supabaseHost ? `https://${supabaseHost}` : ""
const supabaseWs = supabaseHost ? `wss://${supabaseHost}` : ""

/**
 * Content-Security-Policy.
 *
 * A nonce-based script-src would be stricter, but Next only applies nonces during dynamic rendering, so
 * it would turn every page dynamic and defeat Cache Components / the static shell. Instead we allow
 * 'unsafe-inline' scripts (Next's inline hydration/flight payload and the JSON-LD tags need it) and keep
 * the rest tight: everything else is limited to 'self' plus the few hosts this app really talks to.
 * object/base/form/frame/connect are locked down. 'unsafe-eval' and ws://localhost are for dev HMR only.
 * cdn.jsdelivr.net: browser-image-compression's web worker imports its own library from there (admin uploads).
 * Third-party calls such as India Post are server-side and need no entry.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://cdn.jsdelivr.net`,
  "style-src 'self' 'unsafe-inline'",
  ["img-src 'self' data: blob:", supabaseOrigin, "https://lh3.googleusercontent.com"].filter(Boolean).join(" "),
  "font-src 'self' data:",
  ["connect-src 'self'", supabaseOrigin, supabaseWs, "https://cdn.jsdelivr.net", ...(isDev ? ["ws://localhost:*", "http://localhost:*"] : [])]
    .filter(Boolean)
    .join(" "),
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ")

const nextConfig: NextConfig = {
  cacheComponents: true,
  // data-ui ids (see scripts/tag-ui.mjs) are for developers only: keep them out of production HTML
  compiler: process.env.NODE_ENV === "production" ? { reactRemoveProperties: { properties: ["^data-ui$"] } } : {},
  partialPrefetching: true,
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      // Product photos uploaded from the admin panel (Supabase Storage)
      ...(supabaseHost
        ? [{ protocol: "https" as const, hostname: supabaseHost, pathname: "/storage/v1/object/public/**" }]
        : []),
      // Google profile pictures
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Content-Security-Policy", value: csp },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
    ]
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
}

export default nextConfig
