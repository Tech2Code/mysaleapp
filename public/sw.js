/* Kalakriti service worker — fast launch & offline support for the installable app.
 * Strategy:
 *  - Pre-cache: /, /?source=pwa, and /offline on install for instant PWA launch.
 *  - Static build assets (/_next/static): cache-first (they are content-hashed).
 *  - Brand icons (/icons/*, /icon, /apple-icon): network-first with cache fallback so
 *    logo/favicon updates always propagate immediately without manual SW version bumps.
 *  - Manifest (/manifest.webmanifest): never cached by SW so OS WebAPK update checks stay fresh.
 *  - Product images (/_next/image): stale-while-revalidate.
 *  - Public catalogue navigations (/, /products, /category, /about, /contact): stale-while-revalidate
 *    so the installed mobile app opens instantaneously from cache while updating in the background.
 *  - Never touches admin, account, auth, API or non-GET requests.
 */
const VERSION = "v7"
const STATIC_CACHE = `static-${VERSION}`
const PAGES_CACHE = `pages-${VERSION}`
const IMAGE_CACHE = `images-${VERSION}`
const OFFLINE_URL = "/offline"
const PRECACHE_PAGES = ["/", "/?source=pwa", OFFLINE_URL]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(PAGES_CACHE).then((cache) =>
      Promise.all(PRECACHE_PAGES.map((url) => cache.add(url).catch(() => {})))
    )
  )
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  const keep = [STATIC_CACHE, PAGES_CACHE, IMAGE_CACHE]
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !keep.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

const PRIVATE = ["/admin", "/account", "/auth", "/api", "/checkout", "/order-placed", "/track", "/cart", "/wishlist", "/login"]
// Only public catalogue pages are kept for offline use; anything personalised is never stored.
const CACHEABLE_PAGE = /^\/($|(products|category|about|contact|faq|privacy|terms|refund-policy)(\/|$))/
const trimming = new Set()

function isPrivatePath(pathname) {
  return PRIVATE.some((p) => pathname === p || pathname.startsWith(p + "/"))
}

function isPrivateImageRequest(request, url) {
  const src = url.searchParams.get("url") || ""
  if (src.includes("lh3.googleusercontent.com")) return true
  if (!request.referrer) return false
  try {
    const refPath = new URL(request.referrer).pathname
    return refPath === "/admin" || refPath.startsWith("/admin/") || refPath === "/account" || refPath.startsWith("/account/")
  } catch {
    return false
  }
}

async function trimCache(name, max) {
  if (trimming.has(name)) return
  trimming.add(name)
  try {
    const cache = await caches.open(name)
    const keys = await cache.keys()
    for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i])
  } finally {
    trimming.delete(name)
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event
  if (request.method !== "GET") return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (isPrivatePath(url.pathname)) return
  // React Server Component payloads are handled by Next.js itself.
  if (request.headers.get("RSC") || url.searchParams.has("_rsc")) return

  // Never intercept manifest so Chrome/Android WebAPK update checks always read fresh icon versions.
  if (url.pathname === "/manifest.webmanifest") return

  if (url.pathname.startsWith("/_next/static") && !url.pathname.startsWith("/_next/static/development/")) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request)
            .then((res) => {
              if (res.ok) {
                const copy = res.clone()
                caches.open(STATIC_CACHE).then((c) => c.put(request, copy))
              }
              return res
            })
            .catch(() => Response.error())
      )
    )
    return
  }

  // Brand icons & favicons: network-first with cache fallback so logo updates propagate automatically.
  if (url.pathname.startsWith("/icons/") || url.pathname === "/icon" || url.pathname === "/apple-icon") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone()
            caches.open(STATIC_CACHE).then((c) => c.put(request, copy))
          }
          return res
        })
        .catch(async () => (await caches.match(request)) || Response.error())
    )
    return
  }

  if (url.pathname.startsWith("/_next/image")) {
    if (isPrivateImageRequest(request, url)) return
    event.respondWith(
      caches.open(IMAGE_CACHE).then(async (cache) => {
        const hit = await cache.match(request)
        const network = fetch(request)
          .then((res) => {
            if (res.ok) {
              cache.put(request, res.clone())
              trimCache(IMAGE_CACHE, 120)
            }
            return res
          })
          .catch(() => hit || Response.error())
        if (hit) {
          event.waitUntil(network)
          return hit
        }
        return network
      })
    )
    return
  }

  if (request.mode === "navigate") {
    const offlineFallback = async () =>
      (await caches.match(OFFLINE_URL)) ||
      new Response("You are offline. Please check your internet connection.", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      })

    if (CACHEABLE_PAGE.test(url.pathname)) {
      // Network-first with cache fallback so new deployments never serve stale HTML with old chunk/action hashes.
      event.respondWith(
        caches.open(PAGES_CACHE).then(async (cache) => {
          try {
            const res = await fetch(request)
            if (res.ok && !/no-store|private/i.test(res.headers.get("Cache-Control") || "")) {
              cache.put(request, res.clone())
              trimCache(PAGES_CACHE, 40)
            }
            return res
          } catch {
            return (await cache.match(request)) || offlineFallback()
          }
        })
      )
      return
    }
    event.respondWith(
      fetch(request).catch(async () => (await caches.match(request)) || offlineFallback())
    )
  }
})
