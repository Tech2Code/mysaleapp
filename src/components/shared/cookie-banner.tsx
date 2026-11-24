"use client"

import { CheckIcon, CookieIcon, ExternalLinkIcon, ShieldCheckIcon, SlidersHorizontalIcon, XIcon } from "lucide-react"
import Link from "next/link"
import { useEffect, useState, useSyncExternalStore } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import styles from "./cookie-banner.module.css"

const CONSENT_KEY = "kk-cookie-consent-v1"
const OPEN_EVENT = "kk-open-cookie-settings"

export type CookiePreferences = {
  essential: true
  functional: boolean
  analytics: boolean
  updatedAt: string
}

const listeners = new Set<() => void>()

function emitChange() {
  for (const l of listeners) l()
}

function subscribeConsent(cb: () => void) {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

function readRawConsent(): string | null {
  try {
    return localStorage.getItem(CONSENT_KEY)
  } catch {
    return "1"
  }
}

function parsePreferences(raw: string | null): CookiePreferences {
  if (!raw || raw === "1") {
    return { essential: true, functional: false, analytics: false, updatedAt: "" }
  }
  try {
    const parsed = JSON.parse(raw) as Partial<CookiePreferences>
    return {
      essential: true,
      functional: Boolean(parsed.functional),
      analytics: Boolean(parsed.analytics),
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : "",
    }
  } catch {
    return { essential: true, functional: false, analytics: false, updatedAt: "" }
  }
}

/** Opens the Cookie & Storage Preferences modal from anywhere (e.g. the Footer link). */
export function openCookiePreferences() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(OPEN_EVENT))
  }
}

/** Footer trigger button so customers can revisit/withdraw cookie consent anytime (Myntra/Shopify best practice). */
export function CookiePreferencesButton({ className }: { className?: string }) {
  return (
    <button

      type="button"
      onClick={openCookiePreferences}
      className={cn(styles.footerTriggerBtn, className)}
    >
      Cookie preferences
    </button>
  )
}

export type LegalDocTab = "terms" | "privacy" | "refund"

/**
 * Inline Terms, Privacy & Refund Summary Dialog for Sign-Up and Checkout (Baymard e-commerce best practice:
 * lets customers read key clauses and accept without navigating away and losing their form/checkout state).
 */
export function LegalQuickModal({
  open,
  onOpenChange,
  initialTab = "terms",
  onAccept,
}: {
  open: boolean
  onOpenChange: (next: boolean) => void
  initialTab?: LegalDocTab
  onAccept?: () => void
}) {
  const [tab, setTab] = useState<LegalDocTab>(initialTab)
  const [prevInitialTab, setPrevInitialTab] = useState(initialTab)
  if (initialTab !== prevInitialTab) {
    setPrevInitialTab(initialTab)
    setTab(initialTab)
  }

  const fullHref = tab === "terms" ? "/terms" : tab === "privacy" ? "/privacy" : "/refund-policy"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={styles.prefsModal}>
        <DialogHeader>
          <DialogTitle>Store Policies &amp; Customer Terms</DialogTitle>
          <DialogDescription>
            Key highlights of our Terms of Service, Privacy Policy, and Refund Policy.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className={styles.prefsBodyStack}>
          <div role="tablist" aria-label="Policy sections" className={styles.legalTabRow}>
            <button

              type="button"
              role="tab"
              aria-selected={tab === "terms"}
              onClick={() => setTab("terms")}
              className={cn(styles.legalTabBtn, tab === "terms" && styles.legalTabBtnActive)}
            >
              Terms
            </button>
            <button

              type="button"
              role="tab"
              aria-selected={tab === "privacy"}
              onClick={() => setTab("privacy")}
              className={cn(styles.legalTabBtn, tab === "privacy" && styles.legalTabBtnActive)}
            >
              Privacy
            </button>
            <button

              type="button"
              role="tab"
              aria-selected={tab === "refund"}
              onClick={() => setTab("refund")}
              className={cn(styles.legalTabBtn, tab === "refund" && styles.legalTabBtnActive)}
            >
              Refunds
            </button>
          </div>

          {tab === "terms" && (
            <ul className={styles.legalPointList}>
              <li className={styles.legalPointItem}>
                <span className={styles.pointHeading}>1. Handmade Artisanal Pieces</span>
                Each item is crafted by hand in small batches; subtle natural variations in colour or texture are part of handmade work.
              </li>
              <li className={styles.legalPointItem}>
                <span className={styles.pointHeading}>2. Prepaid UPI &amp; 12-Digit UTR Verification</span>
                Orders are placed via UPI payment followed by entering your unique 12-digit UTR reference number. Cash on Delivery is not offered.
              </li>
              <li className={styles.legalPointItem}>
                <span className={styles.pointHeading}>3. Upfront Pricing &amp; Easy Cancellation</span>
                All delivery and special handling fees are shown before payment. You can cancel any Pending or Confirmed order before it is packed.
              </li>
            </ul>
          )}

          {tab === "privacy" && (
            <ul className={styles.legalPointList}>
              <li className={styles.legalPointItem}>
                <span className={styles.pointHeading}>1. Data Minimization &amp; Zero Ad Trackers</span>
                We only collect your name, phone, email, and delivery address to fulfil orders. We never sell your data or run third-party ad trackers.
              </li>
              <li className={styles.legalPointItem}>
                <span className={styles.pointHeading}>2. Zero Marketing Spam &amp; No AI Training</span>
                We send no promotional email spam, and your customer data is never used to train external AI models.
              </li>
              <li className={styles.legalPointItem}>
                <span className={styles.pointHeading}>3. Full Data Access &amp; Easy Deactivation</span>
                Download a human-readable copy of your account data or deactivate your account anytime from Account → Profile.
              </li>
            </ul>
          )}

          {tab === "refund" && (
            <ul className={styles.legalPointList}>
              <li className={styles.legalPointItem}>
                <span className={styles.pointHeading}>1. Return &amp; Exchange Window</span>
                Eligible delivered items can be returned or exchanged within the store&apos;s return window directly from My Orders or Track Order.
              </li>
              <li className={styles.legalPointItem}>
                <span className={styles.pointHeading}>2. Item-Value Refunds via UPI</span>
                Returns after delivery refund the item price to your original UPI/bank account once goods are received back; shipping/handling fees are non-refundable.
              </li>
              <li className={styles.legalPointItem}>
                <span className={styles.pointHeading}>3. Pre-Dispatch Cancellation Refund</span>
                Orders cancelled before packing receive a 100% full refund of the paid amount including shipping fees.
              </li>
            </ul>
          )}

          <div className={styles.legalFooterLinks}>
            <Link

              href={fullHref}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.inlinePolicyLink}
            >
              Read full policy page <ExternalLinkIcon className={styles.btnIcon16} style={{ display: "inline", width: 12, height: 12 }} />
            </Link>
          </div>
        </DialogBody>

        <DialogFooter>
          <Button

            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className={styles.prefsFooterBtn}
          >
            <XIcon className={styles.btnIcon16} /> Close
          </Button>
          {onAccept && (
            <Button

              type="button"
              onClick={() => {
                onAccept()
                onOpenChange(false)
              }}
              className={styles.prefsFooterBtn}
            >
              <CheckIcon className={styles.btnIcon16} /> I agree &amp; accept
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function CookieBanner() {
  const rawConsent = useSyncExternalStore(subscribeConsent, readRawConsent, () => "1")
  const hasDecided = rawConsent !== null
  const savedPrefs = parsePreferences(rawConsent)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [functional, setFunctional] = useState(false)
  const [analytics, setAnalytics] = useState(false)

  useEffect(() => {
    const onOpen = () => {
      const current = parsePreferences(readRawConsent())
      setFunctional(current.functional)
      setAnalytics(current.analytics)
      setDialogOpen(true)
    }
    window.addEventListener(OPEN_EVENT, onOpen)
    return () => window.removeEventListener(OPEN_EVENT, onOpen)
  }, [])

  const saveDecision = (nextFunctional: boolean, nextAnalytics: boolean, toastMsg?: string) => {
    const payload: CookiePreferences = {
      essential: true,
      functional: nextFunctional,
      analytics: nextAnalytics,
      updatedAt: new Date().toISOString(),
    }
    try {
      localStorage.setItem(CONSENT_KEY, JSON.stringify(payload))
      if (!nextFunctional) {
        localStorage.removeItem("kk-recent-searches")
      }
    } catch {
      /* ignore private mode storage quota errors */
    }
    emitChange()
    setDialogOpen(false)
    if (toastMsg) toast.success(toastMsg)
  }

  return (
    <>
      {!hasDecided && !dialogOpen && (
        <aside

          aria-label="Cookie and storage preferences"
          className={styles.cookieBanner}
        >
          <div className={styles.bannerTopRow}>
            <span className={styles.cookieIconBox}>
              <CookieIcon className={styles.cookieSvg} aria-hidden />
            </span>
            <div className={styles.bannerTextCol}>
              <p className={styles.bannerTitle}>Your privacy &amp; cookie choices</p>
              <p className={styles.bannerBody}>
                We use essential cookies and storage for your cart, wishlist, and sign-in. Optional preferences are off by default.{" "}
                <Link href="/privacy" className={styles.policyLink}>
                  Privacy Policy
                </Link>
              </p>
            </div>
          </div>

          <div className={styles.bannerActions}>
            <button

              type="button"
              onClick={() => saveDecision(false, false, "Saved: Essential cookies only.")}
              className={styles.equalBtn}
            >
              Essential only
            </button>
            <button

              type="button"
              onClick={() => {
                setFunctional(savedPrefs.functional)
                setAnalytics(savedPrefs.analytics)
                setDialogOpen(true)
              }}
              className={styles.equalBtn}
            >
              Customize
            </button>
            <button

              type="button"
              onClick={() => saveDecision(true, true, "Cookie preferences saved.")}
              className={cn(styles.equalBtn, styles.equalBtnPrimary)}
            >
              Accept all
            </button>
          </div>
        </aside>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className={styles.prefsModal}>
          <DialogHeader>
            <DialogTitle>Cookie &amp; Storage Preferences</DialogTitle>
            <DialogDescription>
              Choose which browser storage categories are allowed. Non-essential categories are off by default and can be changed anytime from the footer.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className={styles.prefsBodyStack}>
            <div className={styles.categoryCard}>
              <div className={styles.categoryHeaderRow}>
                <h3 className={styles.categoryTitle}>
                  <ShieldCheckIcon className={styles.categoryIcon} aria-hidden />
                  Strictly Necessary
                </h3>
                <span className={styles.alwaysActiveBadge}>
                  Always active
                </span>
              </div>
              <p className={styles.categoryDesc}>
                Required for your shopping cart (`kk-cart`), saved wishlist (`kk-wishlist`), theme mode, and secure login sessions. Cannot be switched off.
              </p>
            </div>

            <div className={styles.categoryCard}>
              <div className={styles.categoryHeaderRow}>
                <h3 className={styles.categoryTitle}>
                  <SlidersHorizontalIcon className={styles.categoryIcon} aria-hidden />
                  Functional Preferences
                </h3>
                <Switch
                  aria-label="Enable functional preferences"
                  checked={functional}
                  onCheckedChange={setFunctional}
                />
              </div>
              <p className={styles.categoryDesc}>
                Remembers convenience features such as your recent product search chips on this device.
              </p>
            </div>

            <div className={styles.categoryCard}>
              <div className={styles.categoryHeaderRow}>
                <h3 className={styles.categoryTitle}>
                  <CookieIcon className={styles.categoryIcon} aria-hidden />
                  Analytics &amp; Diagnostics
                </h3>
                <Switch
                  aria-label="Enable anonymous analytics"
                  checked={analytics}
                  onCheckedChange={setAnalytics}
                />
              </div>
              <p className={styles.categoryDesc}>
                Helps us understand store performance and page reliability. We never use third-party advertising trackers or cross-site ad pixels.
              </p>
            </div>

            <div className={styles.legalFooterLinks}>
              <span>Learn more in our:</span>
              <Link

                href="/privacy"
                onClick={() => setDialogOpen(false)}
                className={styles.inlinePolicyLink}
              >
                Privacy Policy
              </Link>
              <Link

                href="/terms"
                onClick={() => setDialogOpen(false)}
                className={styles.inlinePolicyLink}
              >
                Terms of Service
              </Link>
            </div>
          </DialogBody>

          <DialogFooter>
            <Button

              type="button"
              variant="outline"
              onClick={() => saveDecision(false, false, "Saved: Essential cookies only.")}
              className={styles.prefsFooterBtn}
            >
              Essential only
            </Button>
            <Button

              type="button"
              onClick={() => saveDecision(functional, analytics, "Cookie preferences saved.")}
              className={styles.prefsFooterBtn}
            >
              <CheckIcon className={styles.btnIcon16} /> Save preferences
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
