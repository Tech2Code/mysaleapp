"use client"

import { useEffect, useRef } from "react"

/**
 * Brings the top of the result into view. Use after an action swaps a tall panel for a short one
 * (pay form → "we're verifying", Cancel button → cancellation notice): the page shrinks under the
 * reader and they are left at the bottom, looking at the footer.
 *
 * Scrolls to the nearest marked region (`data-reveal-top`, e.g. the track page's result column),
 * otherwise to the top of the page. Does nothing if that spot is already on screen.
 */
export function revealTop() {
  const behavior: ScrollBehavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"
  const region = document.querySelector<HTMLElement>("[data-reveal-top]")
  if (region) {
    if (region.getBoundingClientRect().top < 0) region.scrollIntoView({ block: "start", behavior })
  } else if (window.scrollY > 0) {
    window.scrollTo({ top: 0, behavior })
  }
}

/** Call revealTop() whenever `key` changes (not on first render). Pass something that changes with the result, e.g. a status. */
export function useRevealOnChange(key: string | number | boolean | null | undefined) {
  const previous = useRef(key)
  useEffect(() => {
    if (previous.current === key) return
    previous.current = key
    revealTop()
  }, [key])
}
