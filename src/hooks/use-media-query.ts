"use client"

import { useCallback, useSyncExternalStore } from "react"

const getServerSnapshot = () => false

/**
 * true while the viewport matches a CSS media query, e.g. useMediaQuery("(max-width: 639px)").
 * Server render and first paint report `false`, so don't use it to change layout that must not jump
 * (use Tailwind breakpoints for that). It is meant for choosing behaviour, like a sheet's side.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const m = window.matchMedia(query)
      m.addEventListener("change", onChange)
      return () => m.removeEventListener("change", onChange)
    },
    [query]
  )
  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query])

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
