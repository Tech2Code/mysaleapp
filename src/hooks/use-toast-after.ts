"use client"

import { useCallback, useEffect, useRef } from "react"

/**
 * Runs a callback (a success toast) right AFTER `pending` turns false, so the loader ends first.
 * `later(fn)`: a newer call replaces an older one; fires exactly once. If nothing is pending it
 * runs on the next microtask. On unmount a waiting callback is flushed (toasts are global).
 */
export function useToastAfter(pending: boolean): (fn: () => void) => void {
  const waiting = useRef<(() => void) | null>(null)
  const isPending = useRef(pending)

  const flush = useCallback(() => {
    const fn = waiting.current
    waiting.current = null
    fn?.()
  }, [])

  useEffect(() => {
    isPending.current = pending
    if (!pending) flush()
  }, [pending, flush])

  useEffect(() => flush, [flush])

  return useCallback(
    (fn: () => void) => {
      waiting.current = fn
      if (!isPending.current) queueMicrotask(flush)
    },
    [flush],
  )
}
