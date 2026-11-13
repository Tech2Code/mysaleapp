"use client"

import { usePathname } from "next/navigation"
import { useEffect, useLayoutEffect } from "react"
import { SCROLL_HOLD, holdFinished, shouldResetScroll } from "@/lib/scroll-reset"

const scrollPositions = new Map<string, number>()

// Module-level navigation state so React Suspense / Strict Mode / remounts never wipe out history flags or scroll positions
let committedPath: string | null = null
let committedKey: string | null = null
let previousPath: string | null = null
let lastScrollY = 0
let viaHistory = false
let isTransitioning = false
let activeNav: { key: string; prevPath: string; viaHistory: boolean } | null = null

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

  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual"
    }
    if (committedPath === null) {
      committedPath = window.location.pathname
      committedKey = window.location.pathname + window.location.search
      lastScrollY = window.scrollY
    }

    let ticking = false
    const onScroll = () => {
      if (isTransitioning) return
      // Only record scroll when browser URL still matches the committed React route
      if (!committedPath || window.location.pathname !== committedPath) return
      const y = window.scrollY
      lastScrollY = y
      if (!ticking) {
        ticking = true
        window.requestAnimationFrame(() => {
          ticking = false
          if (isTransitioning || !committedPath || window.location.pathname !== committedPath) return
          const liveKey = window.location.pathname + window.location.search
          saveScrollPosition(liveKey, committedPath, lastScrollY)
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
          const currentPath = committedPath ?? window.location.pathname
          const liveKey = window.location.pathname + window.location.search
          const currentY = isTransitioning ? lastScrollY : window.scrollY
          saveScrollPosition(liveKey, currentPath, currentY)
          lastScrollY = currentY
          isTransitioning = true
          // If clicking an explicit back link (e.g. "All orders" / "Back to order") returning to the previous route, restore scroll
          if (
            anchor.hasAttribute("data-back-link") ||
            (previousPath && url.pathname === previousPath && currentPath.startsWith(`${url.pathname}/`))
          ) {
            viaHistory = true
          } else {
            viaHistory = false
          }
        }
      } catch {
        // ignore invalid href
      }
    }

    const onPop = (e: PopStateEvent) => {
      if (e.state?.__searchDialog) return
      // Save the leaving page's last known genuine scroll position before popstate mutates scrollY
      if (committedKey && committedPath) {
        saveScrollPosition(committedKey, committedPath, lastScrollY)
      }
      viaHistory = true
      isTransitioning = true
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
    const search = typeof window !== "undefined" ? window.location.search : ""
    const targetKey = `${pathname}${search}`

    if (committedPath === null) {
      committedPath = pathname
      committedKey = targetKey
      lastScrollY = window.scrollY
    }

    let wasHistory: boolean
    let prevPath: string

    if (activeNav && activeNav.key === targetKey) {
      // React Strict Mode or effect re-run for the same target route: preserve the original navigation intent
      wasHistory = activeNav.viaHistory
      prevPath = activeNav.prevPath
    } else {
      wasHistory = viaHistory
      prevPath = committedPath

      // Save the leaving route using its last genuine scroll position (never window.scrollY which Next.js may have reset to 0)
      if (committedKey && committedKey !== targetKey) {
        saveScrollPosition(committedKey, committedPath, lastScrollY)
      }
      if (committedPath !== pathname) {
        previousPath = committedPath
      }

      activeNav = { key: targetKey, prevPath, viaHistory: wasHistory }
      committedPath = pathname
      committedKey = targetKey
      viaHistory = false
    }

    isTransitioning = true

    const decision = {
      previousPath: prevPath,
      nextPath: pathname,
      viaHistory: wasHistory,
      hash: window.location.hash,
    }

    const savedY = wasHistory ? (getSavedScrollPosition(targetKey, pathname) ?? 0) : 0

    const releaseTransition = (finalY: number) => {
      lastScrollY = finalY
      isTransitioning = false
      const liveKey = window.location.pathname + window.location.search
      // Never clobber a non-zero saved history scroll position if the page hasn't grown tall enough yet
      if (wasHistory && savedY > 0 && finalY < 10) return
      saveScrollPosition(liveKey, committedPath ?? pathname, finalY)
    }

    if (wasHistory) {
      return holdAtPosition(savedY, releaseTransition)
    }

    if (!shouldResetScroll(decision)) {
      releaseTransition(window.scrollY)
      return
    }
    return holdAtPosition(0, releaseTransition)
  }, [pathname])

  return null
}

/**
 * Restore scroll to `targetY` immediately and re-apply via ResizeObserver and polling when streamed content
 * or `<Activity>` visibility changes document height or when an internal router effect tries to reset scroll.
 */
function holdAtPosition(targetY: number, onDone: (finalY: number) => void): () => void {
  let stopped = false
  let hasReachedTarget = targetY <= 0

  const applyScroll = () => {
    if (stopped) return
    if (Math.abs(window.scrollY - targetY) > 1) {
      window.scrollTo({ top: targetY, left: 0, behavior: "instant" })
    }
    if (targetY > 0 && Math.abs(window.scrollY - targetY) <= 2) {
      hasReachedTarget = true
    }
  }

  applyScroll()
  const rafId = window.requestAnimationFrame(() => {
    applyScroll()
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
    const reachedTarget = targetY <= 0 || (maxScroll >= targetY && Math.abs(window.scrollY - targetY) <= 2)
    if (reachedTarget) hasReachedTarget = true
    if (holdFinished({ now, startedAt, lastHeightChangeAt }) && (reachedTarget || now - startedAt >= SCROLL_HOLD.maxMs)) {
      stop(false)
    }
  }

  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(checkAndRestore) : null
  ro?.observe(document.body)
  ro?.observe(document.documentElement)

  // Guard against Next.js internal post-commit scrollTo(0) or layout clamping wiping out restoration
  const onScrollGuard = () => {
    if (stopped) return
    if (Math.abs(window.scrollY - targetY) > 2) {
      applyScroll()
    }
  }
  window.addEventListener("scroll", onScrollGuard, { passive: true })

  const pollTimer = window.setInterval(checkAndRestore, 50)

  const events = ["wheel", "touchmove", "keydown"] as const
  const onUserInteract = () => {
    const elapsed = performance.now() - startedAt
    // Ignore trailing momentum wheel/touchmove events from before the navigation
    if (elapsed < 220) return
    // If restoring to a deep scroll position, wait until the target position is actually reached (or 900ms max)
    if (targetY > 0 && !hasReachedTarget && elapsed < 900) return
    stop(false)
  }

  const stop = (cancelled = false) => {
    if (stopped) return
    stopped = true
    window.cancelAnimationFrame(rafId)
    window.clearInterval(pollTimer)
    ro?.disconnect()
    window.removeEventListener("scroll", onScrollGuard)
    for (const e of events) window.removeEventListener(e, onUserInteract)
    if (!cancelled) {
      onDone(window.scrollY)
    }
  }
  for (const e of events) window.addEventListener(e, onUserInteract, { passive: true })
  return () => stop(true)
}
