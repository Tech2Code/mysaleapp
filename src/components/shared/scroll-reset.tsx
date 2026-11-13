"use client"

import { usePathname, useSearchParams } from "next/navigation"
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
let isHolding = false
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

function isParentOrBackPath(targetPath: string, currentPath: string, prevPath: string | null): boolean {
  if (!prevPath || targetPath !== prevPath || targetPath === currentPath) return false
  if (targetPath === "/") return true
  return currentPath.startsWith(`${targetPath}/`)
}

/**
 * Opens every new page at the top, and keeps it there until the page has finished loading.
 * On browser back / forward navigation, restores the saved scroll position as content streams in.
 */
export function ScrollReset() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const searchStr = searchParams.toString()
  const routeKey = searchStr ? `${pathname}?${searchStr}` : pathname

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
      if (!committedPath || !committedKey || window.location.pathname !== committedPath) return
      const y = window.scrollY
      // While back-navigation scroll hold is active, ignore transient resets to 0 before onScrollGuard restores targetY
      if (isHolding && y < 10) return
      lastScrollY = y
      const snapKey = committedKey
      const snapPath = committedPath
      scrollPositions.set(snapKey, y)
      if (snapPath !== snapKey) {
        scrollPositions.set(snapPath, y)
      }
      if (!ticking) {
        ticking = true
        window.requestAnimationFrame(() => {
          ticking = false
          saveScrollPosition(snapKey, snapPath, lastScrollY)
        })
      }
    }

    // Snapshot scroll position on pointerdown before any click or programmatic router.push/back handler runs
    const onPointerDownCapture = () => {
      if (!isTransitioning && committedPath && committedKey && window.location.pathname === committedPath) {
        const y = window.scrollY
        lastScrollY = y
        saveScrollPosition(committedKey, committedPath, y)
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
        const currentPath = committedPath ?? window.location.pathname
        const currentKey = committedKey ?? (window.location.pathname + window.location.search)
        if (window.location.pathname === currentPath && !isTransitioning) {
          lastScrollY = window.scrollY
        }
        saveScrollPosition(currentKey, currentPath, lastScrollY)

        if (url.pathname !== window.location.pathname) {
          isTransitioning = true
          if (anchor.hasAttribute("data-back-link") || isParentOrBackPath(url.pathname, currentPath, previousPath)) {
            viaHistory = true
          } else {
            viaHistory = false
          }
        } else if (url.search !== window.location.search) {
          // Same pathname filter/query change: keep scroll position and do not lock isTransitioning
          viaHistory = false
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
    document.addEventListener("pointerdown", onPointerDownCapture, true)
    document.addEventListener("click", onClickCapture, true)
    return () => {
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("popstate", onPop)
      document.removeEventListener("pointerdown", onPointerDownCapture, true)
      document.removeEventListener("click", onClickCapture, true)
    }
  }, [])

  useLayoutEffect(() => {
    const targetKey = routeKey

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

    const decision = {
      previousPath: prevPath,
      nextPath: pathname,
      viaHistory: wasHistory,
      hash: window.location.hash,
    }

    if (wasHistory) {
      const savedY = getSavedScrollPosition(targetKey, pathname) ?? 0
      lastScrollY = savedY
      if (savedY <= 0) {
        isTransitioning = true
        window.scrollTo({ top: 0, left: 0, behavior: "instant" })
        const rafId = window.requestAnimationFrame(() => {
          window.scrollTo({ top: 0, left: 0, behavior: "instant" })
          lastScrollY = 0
          isTransitioning = false
        })
        return () => {
          window.cancelAnimationFrame(rafId)
        }
      }
      isTransitioning = true
      return holdAtPosition(savedY)
    }

    if (!shouldResetScroll(decision)) {
      isTransitioning = false
      lastScrollY = window.scrollY
      return
    }

    isTransitioning = true
    lastScrollY = 0
    window.scrollTo({ top: 0, left: 0, behavior: "instant" })
    const rafId = window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" })
      lastScrollY = 0
      isTransitioning = false
    })
    return () => {
      window.cancelAnimationFrame(rafId)
    }
  }, [pathname, routeKey])

  return null
}

/**
 * Restore scroll to `targetY` (> 0) immediately and re-apply via ResizeObserver and polling when streamed content
 * or `<Activity>` visibility changes document height or when an internal router effect tries to reset scroll.
 * Never writes to `scrollPositions` so cleanup on navigation can never overwrite another route's saved scroll position.
 */
function holdAtPosition(targetY: number): () => void {
  let stopped = false
  let hasReachedTarget = false
  isHolding = true
  const startedAt = performance.now()

  const applyScroll = () => {
    if (stopped) return
    if (Math.abs(window.scrollY - targetY) > 1) {
      window.scrollTo({ top: targetY, left: 0, behavior: "instant" })
    }
    if (Math.abs(window.scrollY - targetY) <= 2) {
      hasReachedTarget = true
      lastScrollY = window.scrollY
      if (performance.now() - startedAt >= 120) {
        isTransitioning = false
      }
    }
  }

  applyScroll()
  const rafId = window.requestAnimationFrame(applyScroll)

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
    const reachedTarget = maxScroll >= targetY && Math.abs(window.scrollY - targetY) <= 2
    if (reachedTarget) {
      hasReachedTarget = true
      lastScrollY = window.scrollY
      if (now - startedAt >= 120) {
        isTransitioning = false
      }
    }
    if (holdFinished({ now, startedAt, lastHeightChangeAt }) && (reachedTarget || now - startedAt >= SCROLL_HOLD.maxMs)) {
      stop()
    }
  }

  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(checkAndRestore) : null
  ro?.observe(document.body)
  ro?.observe(document.documentElement)

  // Guard against Next.js internal post-commit scrollTo(0) or layout clamping wiping out back-navigation restoration
  const onScrollGuard = () => {
    if (stopped) return
    if (!hasReachedTarget || window.scrollY < 10) {
      applyScroll()
    }
  }
  window.addEventListener("scroll", onScrollGuard, { passive: true })

  const pollTimer = window.setInterval(checkAndRestore, 30)

  const onUserScroll = () => {
    const elapsed = performance.now() - startedAt
    if (!hasReachedTarget && elapsed < 450) return
    stop()
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", " ", "Home", "End"].includes(e.key)) {
      onUserScroll()
    }
  }

  const stop = () => {
    if (stopped) return
    stopped = true
    isHolding = false
    window.cancelAnimationFrame(rafId)
    window.clearInterval(pollTimer)
    ro?.disconnect()
    window.removeEventListener("scroll", onScrollGuard)
    window.removeEventListener("wheel", onUserScroll)
    window.removeEventListener("touchmove", onUserScroll)
    window.removeEventListener("keydown", onKeyDown)
    if (hasReachedTarget) {
      lastScrollY = window.scrollY
    }
    isTransitioning = false
  }
  window.addEventListener("wheel", onUserScroll, { passive: true })
  window.addEventListener("touchmove", onUserScroll, { passive: true })
  window.addEventListener("keydown", onKeyDown, { passive: true })
  return () => stop()
}
