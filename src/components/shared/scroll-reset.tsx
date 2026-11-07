"use client"

import { usePathname } from "next/navigation"
import { useEffect, useLayoutEffect, useRef } from "react"
import { SCROLL_HOLD, holdFinished, shouldResetScroll } from "@/lib/scroll-reset"

/**
 * Opens every new page at the top, and keeps it there until the page has finished loading.
 *
 * Why this exists: Next.js scrolls to the top only ONCE, on the first commit of a navigation, which is the
 * `loading.tsx` skeleton. The real page then streams in and the document changes height (a tall skeleton or
 * a short one, images, the footer moving), so the browser clamps or anchors the scroll position and the
 * page ends up "somewhere": halfway, at the bottom, a bit above the top. That was worst on phones.
 *
 * Mount it ONCE per layout, inside <Suspense fallback={null}> (usePathname needs a boundary).
 * Back / forward and `#hash` links are left to the browser. See CLAUDE.md "Scroll position on navigation".
 */
export function ScrollReset() {
  const pathname = usePathname()
  const previous = useRef(pathname)
  const viaHistory = useRef(false)

  useEffect(() => {
    const onPop = () => {
      viaHistory.current = true
    }
    window.addEventListener("popstate", onPop)
    return () => window.removeEventListener("popstate", onPop)
  }, [])

  useLayoutEffect(() => {
    const decision = {
      previousPath: previous.current,
      nextPath: pathname,
      viaHistory: viaHistory.current,
      hash: window.location.hash,
    }
    previous.current = pathname
    viaHistory.current = false
    if (!shouldResetScroll(decision)) return
    return holdAtTop()
  }, [pathname])

  return null
}

/** Scroll to the top now and again whenever something moves it, until the page settles or the reader scrolls. */
function holdAtTop(): () => void {
  const toTop = () => {
    if (window.scrollY !== 0) window.scrollTo({ top: 0, left: 0, behavior: "instant" })
  }
  toTop()

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
    toTop()
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
