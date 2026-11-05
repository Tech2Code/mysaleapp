"use client"

import { useSyncExternalStore } from "react"

const subscribe = () => () => {}

/**
 * true only on the client after hydration. Use it before rendering values that
 * come from localStorage (cart count, wishlist) to avoid hydration mismatches.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  )
}
