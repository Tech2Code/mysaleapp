"use client"

import { usePathname, useSearchParams } from "next/navigation"
import { useEffect, useLayoutEffect, useRef } from "react"
import { SCROLL_HOLD, holdFinished, shouldResetScroll } from "@/lib/scroll-reset"

const scrollPositions = new Map<string, number>()

function getStorageKey(url: string) {
  return `agy:scroll:${url}`
}

function writePosition(key: string, y: number) {
  scrollPositions.set(key, y)
  try {
    sessionStorage.setItem(getStorageKey(key), String(y))
  } catch {
    // quota exceeded or private mode
  }
}

function saveScrollPosition(fullKey: string, pathnameOnly: string, y: number) {
  if (!fullKey || !Number.isFinite(y) || y < 0) return
  writePosition(fullKey, y)
  if (pathnameOnly && pathnameOnly !== fullKey) {
    writePosition(pathnameOnly, y)
  }
}

function readPosition(key: string): number | null {
  if (!key) return null
  if (scrollPositions.has(key)) return scrollPositions.get(key)!
  try {
    const raw = sessionStorage.getItem(getStorageKey(key))
    if (raw !== null) {
      const num = Number(raw)
      if (Number.isFinite(num) && num >= 0) {
        scrollPositions.set(key, num)
        return num
      }
    }
  } catch {
    // ignore
  }
  return null
}

function getSavedScrollPosition(fullKey: string, pathnameOnly: string): number | null {
  const exact = readPosition(fullKey)
  if (exact !== null) return exact
  return readPosition(pathnameOnly)
}

/**
 * Opens every new page at the top, and keeps it there until the page has finished loading.
 * On browser back / forward navigation, restores the saved scroll position as content streams in.
 */
export function ScrollReset() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const search = searchParams.toString()
  const routeKey = `${pathname}${search ? `?${search}` : ""}`

  const committedPath = useRef(pathname)
  const committedKey = useRef(routeKey)
  const lastScrollY = useRef(0)
  const viaHistory = useRef(false)
  const isTransitioning = useRef(false)

  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual"
    }
    lastScrollY.current = window.scrollY
    saveScrollPosition(committedKey.current, committedPath.current, window.scrollY)

    let ticking = false
    const onScroll = () => {
      if (isTransitioning.current) return
      // Only record scroll when browser URL still matches the committed React route
      if (window.location.pathname !== committedPath.current) return
      const y = window.scrollY
      lastScrollY.current = y
      if (!ticking) {
        ticking = true
        window.requestAnimationFrame(() => {
          ticking = false
          if (isTransitioning.current || window.location.pathname !== committedPath.current) return
          const liveKey = window.location.pathname + window.location.search
          saveScrollPosition(liveKey, committedPath.current, lastScrollY.current)
        })
      }
    }

    // Snapshot scroll position the instant the user clicks an internal link (before Next.js resets scroll)
    const onClickCapture = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const anchor = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null
      if (!anchor || (anchor.target && anchor.target !== "_self") || anchor.hasAttribute("download")) return
      try {
        const url = new URL(anchor.href, window.location.href)
        if (url.origin !== window.location.origin) return
        if (url.pathname !== window.location.pathname || url.search !== window.location.search) {
          const liveKey = window.location.pathname + window.location.search
          saveScrollPosition(liveKey, committedPath.current, window.scrollY)
          lastScrollY.current = window.scrollY
          isTransitioning.current = true
        }
      } catch {
        // ignore invalid href
      }
    }

    const onPop = () => {
      // Save the leaving page's last known genuine scroll position before popstate mutates scrollY
      saveScrollPosition(committedKey.current, committedPath.current, lastScrollY.current)
      viaHistory.current = true
      isTransitioning.current = true
    }

    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("popstate", onPop)
    document.addEventListener("click", onClickCapture, true)
    return () => {
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("popstate", onPop)
      document.removeEventListener("click", onClickCapture, true)
    }
  }, [])

  useLayoutEffect(() => {
    const targetKey = `${pathname}${window.location.search || (search ? `?${search}` : "")}`
    const wasHistory = viaHistory.current
    const decision = {
      previousPath: committedPath.current,
      nextPath: pathname,
      viaHistory: wasHistory,
      hash: window.location.hash,
    }

    // Save the leaving route using its last genuine scroll position (never window.scrollY which Next.js may have reset to 0)
    if (committedKey.current && committedKey.current !== targetKey) {
      saveScrollPosition(committedKey.current, committedPath.current, lastScrollY.current)
    }

    committedPath.current = pathname
    committedKey.current = targetKey
    viaHistory.current = false

    const releaseTransition = (finalY: number) => {
      lastScrollY.current = finalY
      isTransitioning.current = false
    }

    if (wasHistory) {
      const savedY = getSavedScrollPosition(targetKey, pathname) ?? 0
      return holdAtPosition(savedY, releaseTransition)
    }

    if (!shouldResetScroll(decision)) {
      releaseTransition(window.scrollY)
      return
    }
    return holdAtPosition(0, releaseTransition)
  }, [pathname, search])

  return null
}

/**
 * Restore scroll to `targetY` immediately and re-apply via ResizeObserver only when streamed content
 * changes document height or when an internal router effect tries to reset scroll during transition.
 */
function holdAtPosition(targetY: number, onDone: (finalY: number) => void): () => void {
  let stopped = false
  const applyScroll = () => {
    if (stopped) return
    if (Math.abs(window.scrollY - targetY) > 1) {
      window.scrollTo({ top: targetY, left: 0, behavior: "instant" })
    }
  }

  applyScroll()
  const rafId = window.requestAnimationFrame(() => {
    applyScroll()
    if (targetY === 0) onDone(0)
  })

  const startedAt = performance.now()
  let lastHeightChangeAt = startedAt
  let height = document.documentElement.scrollHeight

  const checkAndRestore = () => {
    if (stopped) return
    const now = performance.now()
    const next = document.documentElement.scrollHeight
    if (next !== height) {
      height = next
      lastHeightChangeAt = now
    }
    applyScroll()
    const maxScroll = Math.max(0, next - window.innerHeight)
    if (targetY > 0 && maxScroll >= targetY && Math.abs(window.scrollY - targetY) <= 2) {
      onDone(window.scrollY)
    }
    if (holdFinished({ now, startedAt, lastHeightChangeAt })) {
      stop()
    }
  }

  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(checkAndRestore) : null
  ro?.observe(document.body)

  // Guard against Next.js internal post-commit scrollTo(0) wiping out back-navigation restoration
  const onScrollGuard = () => {
    if (stopped) return
    const now = performance.now()
    if (now - startedAt < 350 && targetY > 0 && window.scrollY < 10) {
      applyScroll()
    }
  }
  window.addEventListener("scroll", onScrollGuard, { passive: true })

  const settleTimer = window.setTimeout(() => {
    checkAndRestore()
    stop()
  }, SCROLL_HOLD.stableMs)

  const events = ["wheel", "touchmove", "keydown", "mousedown"] as const
  const stop = () => {
    if (stopped) return
    stopped = true
    window.cancelAnimationFrame(rafId)
    window.clearTimeout(settleTimer)
    ro?.disconnect()
    window.removeEventListener("scroll", onScrollGuard)
    for (const e of events) window.removeEventListener(e, stop)
    onDone(window.scrollY)
  }
  for (const e of events) window.addEventListener(e, stop, { passive: true })
  return stop
}
