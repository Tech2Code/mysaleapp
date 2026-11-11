"use client"

import { usePathname } from "next/navigation"
import { useEffect, useLayoutEffect, useRef } from "react"
import { SCROLL_HOLD, holdFinished, shouldResetScroll } from "@/lib/scroll-reset"

const scrollPositions = new Map<string, number>()

function getStorageKey(url: string) {
  return `agy:scroll:${url}`
}

function saveScrollPosition(url: string, y: number) {
  scrollPositions.set(url, y)
  try {
    sessionStorage.setItem(getStorageKey(url), String(y))
  } catch {
    // quota exceeded or private mode
  }
}

function getSavedScrollPosition(url: string): number | null {
  if (scrollPositions.has(url)) return scrollPositions.get(url)!
  try {
    const raw = sessionStorage.getItem(getStorageKey(url))
    if (raw !== null) {
      const num = Number(raw)
      if (Number.isFinite(num)) return num
    }
  } catch {
    // ignore
  }
  return null
}

function currentUrlKey() {
  if (typeof window === "undefined") return ""
  return window.location.pathname + window.location.search
}

/**
 * Opens every new page at the top, and keeps it there until the page has finished loading.
 * On browser back / forward navigation, restores the saved scroll position as content streams in.
 */
export function ScrollReset() {
  const pathname = usePathname()
  const previous = useRef(pathname)
  const previousKey = useRef(currentUrlKey())
  const viaHistory = useRef(false)

  // Continuously record scroll position for the current URL so back button knows where to return
  useEffect(() => {
    let ticking = false
    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          saveScrollPosition(currentUrlKey(), window.scrollY)
          ticking = false
        })
        ticking = true
      }
    }

    const onPop = () => {
      viaHistory.current = true
    }

    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("popstate", onPop)
    return () => {
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("popstate", onPop)
    }
  }, [])

  useLayoutEffect(() => {
    const targetKey = currentUrlKey()
    const wasHistory = viaHistory.current
    const decision = {
      previousPath: previous.current,
      nextPath: pathname,
      viaHistory: wasHistory,
      hash: window.location.hash,
    }

    // Save scroll of leaving page before switching
    if (previousKey.current && previousKey.current !== targetKey) {
      saveScrollPosition(previousKey.current, window.scrollY)
    }

    previous.current = pathname
    previousKey.current = targetKey
    viaHistory.current = false

    if (wasHistory) {
      // Restore previous scroll position on back/forward
      const savedY = getSavedScrollPosition(targetKey)
      if (savedY != null && savedY > 0) {
        return holdAtPosition(savedY)
      }
      return
    }

    if (!shouldResetScroll(decision)) return
    return holdAtTop()
  }, [pathname])

  return null
}

/** Keep scroll at target position while content streams in and settles. */
function holdAtPosition(targetY: number): () => void {
  const toPos = () => {
    window.scrollTo({ top: targetY, left: 0, behavior: "instant" })
  }
  toPos()

  const startedAt = performance.now()
  let lastHeightChangeAt = startedAt
  let height = document.body.scrollHeight

  const tick = () => {
    const now = performance.now()
    const next = document.body.scrollHeight
    if (next !== height) {
      height = next
      lastHeightChangeAt = now
    }
    toPos()
    if (holdFinished({ now, startedAt, lastHeightChangeAt })) stop()
  }

  const timer = window.setInterval(tick, SCROLL_HOLD.pollMs)
  // The reader took over: never fight them.
  const events = ["wheel", "touchmove", "keydown", "mousedown"] as const
  const stop = () => {
    window.clearInterval(timer)
    for (const e of events) window.removeEventListener(e, stop)
  }
  for (const e of events) window.addEventListener(e, stop, { passive: true })
  return stop
}

/** Scroll to the top now and again whenever something moves it, until the page settles or the reader scrolls. */
function holdAtTop(): () => void {
  return holdAtPosition(0)
}
