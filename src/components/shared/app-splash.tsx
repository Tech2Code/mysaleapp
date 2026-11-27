"use client"

import { useEffect, useState } from "react"
import { BrandGlyph } from "@/components/shared/brand-glyph"
import { useStoreSettings } from "@/components/store/store-settings-provider"
import { cn } from "@/lib/utils"
import styles from "./app-splash.module.css"

const SPLASH_KEY = "kk-app-splash-v1"

/**
 * Branded animated launch splash shown once per browser session (and on PWA cold launch)
 * across both web and mobile. Respects prefers-reduced-motion and never blocks navigation.
 */
export function AppSplash() {
  const shop = useStoreSettings()
  const [phase, setPhase] = useState<"idle" | "open" | "closing" | "done">("idle")

  useEffect(() => {
    try {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        return
      }
      if (sessionStorage.getItem(SPLASH_KEY)) {
        return
      }
      sessionStorage.setItem(SPLASH_KEY, "1")
    } catch {
      return
    }

    // Show immediately on cold start, then fade out smoothly
    const startTimer = window.setTimeout(() => setPhase("open"), 0)
    const closeTimer = window.setTimeout(() => setPhase("closing"), 780)
    const doneTimer = window.setTimeout(() => setPhase("done"), 1120)
    return () => {
      window.clearTimeout(startTimer)
      window.clearTimeout(closeTimer)
      window.clearTimeout(doneTimer)
    }
  }, [])

  if (phase === "idle" || phase === "done") return null

  return (
    <div
      className={cn(styles.splashOverlay, phase === "closing" && styles.splashOverlayClosing)}
      aria-hidden="true"
    >
      <div className={styles.splashLogoStage}>
        <span className={styles.splashHaloRing} />
        <span className={styles.splashBadge}>
          <BrandGlyph size={58} />
        </span>
      </div>
      <div className={styles.splashBrandBlock}>
        <p className={styles.splashShopName}>{shop.shopName}</p>
        {shop.tagline && <p className={styles.splashTagline}>{shop.tagline}</p>}
      </div>
      <div className={styles.splashProgressTrack}>
        <div className={styles.splashProgressFill} />
      </div>
    </div>
  )
}
