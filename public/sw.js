/* Kalakriti service worker — offline support for the installable app.
 * Strategy:
 *  - Static build assets (/_next/static, fonts, icons): cache-first (they are content-hashed).
 *  - Product images (/_next/image): stale-while-revalidate.
 *  - Page navigations: network-first, fall back to the cached page, then /offline.
 *  - Never touches admin, account, auth, API or non-GET requests.
 */
const VERSION = "v2"
const STATIC_CACHE = `static-${VERSION}`
const PAGES_CACHE = `pages-${VERSION}`
const IMAGE_CACHE = `images-${VERSION}`
const OFFLINE_URL = "/offline"

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(PAGES_CACHE).then((cache) => cache.add(OFFLINE_URL)))
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
const CACHEABLE_PAGE = /^\/($|(products|category|about|contact)(\/|$))/
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

  if (url.pathname.startsWith("/_next/static")) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            if (res.ok) {
              const copy = res.clone()
              caches.open(STATIC_CACHE).then((c) => c.put(request, copy))
            }
            return res
          })
      )
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
          .catch(() => hit)
        return hit || network
      })
    )
    return
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok && CACHEABLE_PAGE.test(url.pathname) && !/no-store|private/.test(res.headers.get("Cache-Control") || "")) {
            const copy = res.clone()
            caches.open(PAGES_CACHE).then((c) => {
              c.put(request, copy)
              trimCache(PAGES_CACHE, 40)
            })
          }
          return res
        })
        .catch(async () => (await caches.match(request)) || caches.match(OFFLINE_URL))
    )
  }
})
