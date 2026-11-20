"use client"

import { useEffect } from "react"

/** Registers the PWA service worker (production only; in dev, unregisters any lingering worker so dev HMR/chunks aren't cached). */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return
    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => Promise.all(regs.map((r) => r.unregister())))
        .catch(() => {})
      return
    }
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Non-fatal: the site works normally without offline support.
    })
  }, [])
  return null
}
