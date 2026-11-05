"use client"

import { DownloadIcon, ShareIcon, SquarePlusIcon, XIcon } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { useInstallPrompt } from "@/hooks/use-install-prompt"
import { cn } from "@/lib/utils"
import { LogoMark } from "@/components/shared/logo"
import { useStoreSettings } from "./store-settings-provider"

/**
 * A small "Install app" banner at the bottom of the screen, shown a few seconds after arriving.
 * Hidden when already installed, when dismissed (for 14 days), or when the browser can't install the app.
 */
export function InstallPrompt() {
  const shop = useStoreSettings()
  const { canInstall, needsManualSteps, dismissed, install, dismiss } = useInstallPrompt()
  const [ready, setReady] = useState(false)

  // not right at page load: let people look around first
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 6000)
    return () => clearTimeout(t)
  }, [])

  const show = ready && canInstall && !dismissed

  return (
    <AnimatePresence>
      {show && (
        <motion.aside
          data-ui="store/InstallPrompt"
          role="dialog"
          aria-label={`Install ${shop.shopName}`}
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ type: "spring", stiffness: 320, damping: 30 }}
          className={cn(
            "fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 mx-auto max-w-md rounded-2xl border bg-card p-4 shadow-2xl shadow-black/15",
            "sm:right-auto sm:left-6 sm:mx-0 sm:bottom-6"
          )}
        >
          <button
            type="button"
            onClick={dismiss}
            aria-label="Not now"
            className="absolute top-2 right-2 grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <XIcon className="size-4" />
          </button>
          <div className="flex items-start gap-3 pr-6">
            <LogoMark className="size-11 shrink-0 text-xl" />
            <div className="min-w-0">
              <p className="text-sm leading-snug font-semibold">Get the {shop.shopName} app</p>
              <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                Faster shopping, order tracking and offers, right from your home screen.
              </p>
            </div>
          </div>

          {needsManualSteps ? (
            <ol className="mt-3 space-y-2 rounded-xl bg-muted/60 p-3 text-xs leading-snug">
              <li className="flex items-center gap-2">
                <ShareIcon className="size-4 shrink-0 text-primary" aria-hidden /> Tap <span className="font-semibold">Share</span> in Safari&apos;s toolbar
              </li>
              <li className="flex items-center gap-2">
                <SquarePlusIcon className="size-4 shrink-0 text-primary" aria-hidden /> Choose <span className="font-semibold">Add to Home Screen</span>
              </li>
            </ol>
          ) : (
            <Button type="button" onClick={() => void install()} className="mt-3 h-10 w-full rounded-full">
              <DownloadIcon /> Install app
            </Button>
          )}
        </motion.aside>
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
      data-ui="store/InstallButton"
      onClick={() => (needsManualSteps ? toast.info("Tap Share in Safari, then “Add to Home Screen”.", { duration: 6000 }) : void install())}
      className={cn(
        "inline-flex h-10 items-center gap-2 rounded-full border bg-card px-4 text-sm font-semibold transition-colors hover:bg-muted",
        className
      )}
    >
      <DownloadIcon className="size-4" aria-hidden /> Install app
    </button>
  )
}
