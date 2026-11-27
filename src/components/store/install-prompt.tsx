"use client"

import { DownloadIcon, ShareIcon, SquarePlusIcon, XIcon } from "lucide-react"
import { AnimatePresence } from "motion/react"
import * as m from "motion/react-m"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { useInstallPrompt } from "@/hooks/use-install-prompt"
import { cn } from "@/lib/utils"
import { LogoMark } from "@/components/shared/logo"
import { useStoreSettings } from "./store-settings-provider"
import styles from "./store-widgets.module.css"

const QUIET_INSTALL_PATHS = ["/checkout", "/cart", "/login", "/order-placed", "/account", "/track"]

/**
 * A small "Install app" banner at the bottom of the screen, shown a few seconds after arriving.
 * Hidden when already installed, when dismissed (for 14 days), on focused flows (checkout/cart/login/account),
 * or when the browser can't install the app.
 */
export function InstallPrompt() {
  const pathname = usePathname()
  const shop = useStoreSettings()
  const { canInstall, needsManualSteps, dismissed, install, dismiss } = useInstallPrompt()
  const [ready, setReady] = useState(false)

  // not right at page load: let people look around first
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 6000)
    return () => clearTimeout(t)
  }, [])

  const isQuietRoute = Boolean(pathname && QUIET_INSTALL_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`)))
  const show = ready && canInstall && !dismissed && !isQuietRoute

  return (
    <AnimatePresence>
      {show && (
        <m.aside

          role="dialog"
          aria-label={`Install ${shop.shopName}`}
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ type: "spring", stiffness: 320, damping: 30 }}
          className={styles.installBanner}
        >
          <button
            type="button"
            onClick={dismiss}
            aria-label="Not now"
            className={styles.dismissBtn}
          >
            <XIcon className={styles.closeSvg} />
          </button>
          <div className={styles.bannerHeaderRow}>
            <LogoMark className={styles.logoMarkBox} />
            <div className={styles.bannerTextCol}>
              <p className={styles.bannerTitle}>Get the {shop.shopName} app</p>
              <p className={styles.bannerDesc}>
                Faster shopping, order tracking and offers, right from your home screen.
              </p>
            </div>
          </div>

          {needsManualSteps ? (
            <ol className={styles.manualStepsList}>
              <li className={styles.stepRow}>
                <ShareIcon className={styles.stepSvg} aria-hidden /> Tap <span className={styles.stepStrong}>Share</span> in Safari&apos;s toolbar
              </li>
              <li className={styles.stepRow}>
                <SquarePlusIcon className={styles.stepSvg} aria-hidden /> Choose <span className={styles.stepStrong}>Add to Home Screen</span>
              </li>
            </ol>
          ) : (
            <Button type="button" onClick={() => void install()} className={styles.installActionBtn}>
              <DownloadIcon /> Install app
            </Button>
          )}
        </m.aside>
      )}
    </AnimatePresence>
  )
}

/** "Install app" link for the footer: always available (even after dismissing the banner) when installing is possible. */
export function InstallButton({ className }: { className?: string }) {
  const { canInstall, needsManualSteps, install } = useInstallPrompt()
  if (!canInstall) return null
  return (
    <button
      type="button"

      onClick={() => (needsManualSteps ? toast.info("Tap Share in Safari, then “Add to Home Screen”.", { duration: 6000 }) : void install())}
      className={cn(styles.footerInstallBtn, className)}
    >
      <DownloadIcon className={styles.downloadSvg} aria-hidden /> Install app
    </button>
  )
}
