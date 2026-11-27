"use client"

import { useCallback, useEffect, useRef } from "react"

/**
 * Reusable browser/mobile-Back history manager for full-page multi-step flows
 * (e.g., `/checkout`, multi-step onboarding, etc.).
 *
 * - Moving forward (step 1 -> 2 -> 3) pushes history states under `stateKey`.
 * - Mobile hardware/swipe Back and browser Back step cleanly 3 -> 2 -> 1 -> previous page.
 * - In-app Back calls `history.go(delta)` so no orphan history entries remain.
 * - Guards against firing off-screen when Next.js `<Activity>` keeps routes mounted.
 */
export function useStepHistory<T extends number>({
  pathname,
  stateKey,
  step,
  minStep,
  maxStep,
  onStepChange,
}: {
  pathname: string
  stateKey: string
  step: T
  minStep: T
  maxStep: T
  onStepChange: (next: T) => void
}) {
  const stepRef = useRef<T>(step)
  const pushedStepsRef = useRef(0)

  useEffect(() => {
    stepRef.current = step
  }, [step])

  useEffect(() => {
    const onPopState = (e: PopStateEvent) => {
      if (window.location.pathname !== pathname) return
      const raw = (e.state as Record<string, unknown> | null)?.[stateKey]
      const target =
        typeof raw === "number" && Number.isInteger(raw) && raw >= minStep && raw <= maxStep
          ? (raw as T)
          : minStep
      if (target !== stepRef.current) {
        pushedStepsRef.current = Math.max(0, target - minStep)
        onStepChange(target)
      }
    }
    window.addEventListener("popstate", onPopState)
    return () => {
      window.removeEventListener("popstate", onPopState)
    }
  }, [pathname, stateKey, minStep, maxStep, onStepChange])

  const goToStep = useCallback(
    (next: T) => {
      const current = stepRef.current
      if (next === current) return
      if (typeof window !== "undefined") {
        if (next > current) {
          for (let s = current + 1; s <= next; s += 1) {
            window.history.pushState(
              { ...(window.history.state ?? {}), [stateKey]: s },
              ""
            )
            pushedStepsRef.current += 1
          }
          onStepChange(next)
          return
        }
        if (next < current && pushedStepsRef.current >= current - next) {
          const delta = next - current
          pushedStepsRef.current = Math.max(0, pushedStepsRef.current + delta)
          window.history.go(delta)
          return
        }
      }
      onStepChange(next)
    },
    [stateKey, onStepChange]
  )

  const resetHistoryDepth = useCallback(() => {
    pushedStepsRef.current = 0
  }, [])

  return { goToStep, resetHistoryDepth }
}
