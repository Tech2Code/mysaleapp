"use client"

import { useEffect } from "react"

/** Registers the PWA service worker (production only, so dev HMR isn't cached). */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Non-fatal: the site works normally without offline support.
    })
  }, [])
  return null
}
