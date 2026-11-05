"use client"

import { useSyncExternalStore } from "react"

/**
 * true while the viewport matches a CSS media query, e.g. useMediaQuery("(max-width: 639px)").
 * Server render and first paint report `false`, so don't use it to change layout that must not jump
 * (use Tailwind breakpoints for that). It is meant for choosing behaviour, like a sheet's side.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const m = window.matchMedia(query)
      m.addEventListener("change", onChange)
      return () => m.removeEventListener("change", onChange)
    },
    () => window.matchMedia(query).matches,
    () => false
  )
}
