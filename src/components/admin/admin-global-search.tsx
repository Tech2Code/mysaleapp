"use client"

import {
  ArrowLeftIcon,
  BadgePercentIcon,
  ChevronRightIcon,
  ExternalLinkIcon,
  GlobeIcon,
  IndianRupeeIcon,
  KeyRoundIcon,
  LayoutDashboardIcon,
  Loader2Icon,
  MailIcon,
  PackageIcon,
  PaletteIcon,
  PhoneIcon,
  PlusIcon,
  ReceiptIcon,
  RefreshCwIcon,
  RocketIcon,
  RotateCcwIcon,
  SearchIcon,
  SearchXIcon,
  SettingsIcon,
  ShieldCheckIcon,
  ShoppingCartIcon,
  StoreIcon,
  TagsIcon,
  TicketPercentIcon,
  TruckIcon,
  UserRoundCogIcon,
  XIcon,
  type LucideIcon,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Fragment, useCallback, useEffect, useId, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { Skeletonize } from "@/components/shared/skeletonize"
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { searchAdminGlobal, type AdminGlobalSearchResults } from "@/features/admin/search-actions"
import { formatPrice } from "@/lib/format"
import { cn } from "@/lib/utils"
import styles from "./admin-global-search.module.css"

export const OPEN_ADMIN_SEARCH_EVENT = "kk-open-admin-search"

export function openAdminGlobalSearch() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(OPEN_ADMIN_SEARCH_EVENT))
  }
}

type SearchGroup = "Pages & Actions" | "Settings & Features"

type StaticSearchItem = {
  id: string
  group: SearchGroup
  label: string
  hint: string
  href: string
  icon: LucideIcon
  badge?: string
  keywords: string[]
  external?: boolean
}

const STATIC_ADMIN_INDEX: StaticSearchItem[] = [
  // Pages & Operations
  {
    id: "page-dashboard",
    group: "Pages & Actions",
    label: "Dashboard overview",
    hint: "Revenue, orders, AOV, sales chart & action queue",
    href: "/admin",
    icon: LayoutDashboardIcon,
    keywords: ["home", "dashboard", "overview", "metrics", "analytics", "revenue", "sales", "chart", "kpi"],
  },
  {
    id: "page-orders",
    group: "Pages & Actions",
    label: "All orders",
    hint: "View, filter, confirm, ship & refund orders",
    href: "/admin/orders",
    icon: ShoppingCartIcon,
    keywords: ["orders", "sales", "customers", "fulfil", "fulfill", "ship", "invoice", "utr"],
  },
  {
    id: "page-orders-verify",
    group: "Pages & Actions",
    label: "Payments to verify",
    hint: "Pending UPI / UTR verification queue",
    href: "/admin/orders?view=to-verify",
    icon: IndianRupeeIcon,
    badge: "Queue",
    keywords: ["verify", "payment", "utr", "upi", "pending", "approve", "reject"],
  },
  {
    id: "page-orders-ship",
    group: "Pages & Actions",
    label: "To pack & ship",
    hint: "Confirmed orders ready for dispatch & courier tracking",
    href: "/admin/orders?view=to-ship",
    icon: TruckIcon,
    badge: "Queue",
    keywords: ["pack", "ship", "dispatch", "courier", "awb", "tracking", "confirmed"],
  },
  {
    id: "page-orders-returns",
    group: "Pages & Actions",
    label: "Return & exchange requests",
    hint: "Approve, pickup, restock & refund customer returns",
    href: "/admin/orders?view=return-requests",
    icon: RotateCcwIcon,
    badge: "Queue",
    keywords: ["return", "exchange", "refund", "pickup", "restock", "rma"],
  },
  {
    id: "page-products",
    group: "Pages & Actions",
    label: "Products catalogue",
    hint: "Manage products, stock, variants & back-in-stock alerts",
    href: "/admin/products",
    icon: PackageIcon,
    keywords: ["products", "inventory", "stock", "variants", "sizes", "sku", "catalog", "catalogue", "back in stock", "alerts"],
  },
  {
    id: "page-products-new",
    group: "Pages & Actions",
    label: "Add new product",
    hint: "Create a new product listing with photos & variants",
    href: "/admin/products/new",
    icon: PlusIcon,
    badge: "Action",
    keywords: ["new", "add", "create", "product", "item", "listing", "upload"],
  },
  {
    id: "page-categories",
    group: "Pages & Actions",
    label: "Categories",
    hint: "Create, rename & organise product collections",
    href: "/admin/categories",
    icon: TagsIcon,
    keywords: ["categories", "collections", "tags", "groups"],
  },
  {
    id: "page-account",
    group: "Pages & Actions",
    label: "My account & security",
    hint: "Admin profile, 4-digit Quick PIN lock & password",
    href: "/admin/account",
    icon: UserRoundCogIcon,
    keywords: ["account", "profile", "pin", "lock", "4-digit", "password", "security", "sign out"],
  },
  {
    id: "page-launch",
    group: "Pages & Actions",
    label: "Data & launch readiness",
    hint: "Pre-launch checklist & health checks",
    href: "/admin/launch?section=checklist",
    icon: RocketIcon,
    keywords: ["launch", "checklist", "ready", "health", "go live"],
  },
  {
    id: "page-launch-reset",
    group: "Settings & Features",
    label: "Clear test / demo data",
    hint: "Data & launch → Reset orders, customers or catalog",
    href: "/admin/launch?section=reset",
    icon: RocketIcon,
    badge: "Data",
    keywords: ["reset", "clear", "demo", "test data", "wipe", "delete"],
  },
  {
    id: "page-storefront",
    group: "Pages & Actions",
    label: "View live storefront",
    hint: "Open the customer-facing shop in a new tab",
    href: "/",
    icon: ExternalLinkIcon,
    badge: "Store",
    external: true,
    keywords: ["store", "storefront", "website", "live", "shop", "preview"],
  },

  // Granular Settings & Minor Features
  {
    id: "set-store-profile",
    group: "Settings & Features",
    label: "Shop name, tagline & description",
    hint: "Settings → Shop & Brand",
    href: "/admin/settings?section=store",
    icon: StoreIcon,
    badge: "Shop & Brand",
    keywords: ["shop", "brand", "name", "tagline", "description", "title", "storefront"],
  },
  {
    id: "set-announcement",
    group: "Settings & Features",
    label: "Announcement banner & home badge",
    hint: "Top promo bar, home hero badge & product highlight line",
    href: "/admin/settings?section=store",
    icon: StoreIcon,
    badge: "Shop & Brand",
    keywords: ["announcement", "banner", "topbar", "sale", "hero", "badge", "highlight", "perk"],
  },
  {
    id: "set-socials",
    group: "Settings & Features",
    label: "Instagram & Facebook social links",
    hint: "Footer & Contact page social profile URLs",
    href: "/admin/settings?section=store",
    icon: GlobeIcon,
    badge: "Shop & Brand",
    keywords: ["social", "instagram", "facebook", "links", "footer"],
  },
  {
    id: "set-theme-appearance",
    group: "Settings & Features",
    label: "Theme & Appearance (8 presets + Custom)",
    hint: "Unified Storefront & Admin colors, Light/Dark & custom palette",
    href: "/admin/settings?section=appearance",
    icon: PaletteIcon,
    badge: "Appearance",
    keywords: ["theme", "appearance", "color", "colors", "palette", "custom theme", "brand color", "dark mode"],
  },
  {
    id: "set-contact-whatsapp",
    group: "Settings & Features",
    label: "WhatsApp & calling phone number",
    hint: "Settings → Contact & Location",
    href: "/admin/settings?section=contact",
    icon: PhoneIcon,
    badge: "Contact",
    keywords: ["whatsapp", "phone", "mobile", "call", "contact", "support", "number"],
  },
  {
    id: "set-contact-location",
    group: "Settings & Features",
    label: "Store email, pincode, city & state",
    hint: "Contact details, pincode auto-fill & invoice origin state",
    href: "/admin/settings?section=contact",
    icon: PhoneIcon,
    badge: "Contact",
    keywords: ["email", "pincode", "pin code", "postal", "zip", "city", "district", "state", "location", "address"],
  },
  {
    id: "set-seo",
    group: "Settings & Features",
    label: "Google & SEO keywords",
    hint: "Meta search keywords & Google snippet preview",
    href: "/admin/settings?section=seo",
    icon: BadgePercentIcon,
    badge: "SEO",
    keywords: ["seo", "google", "keywords", "meta", "search", "ranking", "preview"],
  },
  {
    id: "set-payment-mode",
    group: "Settings & Features",
    label: "Payment mode, UPI ID & Payment Gateway",
    hint: "Switch between Direct UPI (₹0 fee) & Razorpay / Gateway",
    href: "/admin/settings?section=payments",
    icon: IndianRupeeIcon,
    badge: "Payments",
    keywords: ["payment", "upi", "qr", "gateway", "razorpay", "cashfree", "phonepe", "payee", "vpa", "checkout"],
  },
  {
    id: "set-gst-tax",
    group: "Settings & Features",
    label: "GST registration, GSTIN & Tax Invoices",
    hint: "Toggle GST, set GSTIN, GST rate (%), legal name & invoice address",
    href: "/admin/settings?section=payments",
    icon: ReceiptIcon,
    badge: "Payments & Tax",
    keywords: ["gst", "gstin", "tax", "invoice", "bill of supply", "cgst", "sgst", "igst", "legal name", "price note", "business address"],
  },
  {
    id: "set-delivery",
    group: "Settings & Features",
    label: "Delivery charges, free shipping & weight rules",
    hint: "Flat fee, free delivery threshold, fragile, bulky & extra-kg rates",
    href: "/admin/settings?section=shipping",
    icon: TruckIcon,
    badge: "Delivery",
    keywords: ["delivery", "shipping", "free delivery", "fragile", "bulky", "oversized", "weight", "kg", "grams", "handling", "surcharge"],
  },
  {
    id: "set-order-rules",
    group: "Settings & Features",
    label: "Order code prefix, UTR expiry & return window",
    hint: "Order prefix (e.g. KK-), auto-cancel hours & return days",
    href: "/admin/settings?section=shipping",
    icon: SettingsIcon,
    badge: "Orders",
    keywords: ["prefix", "order code", "expiry", "auto-cancel", "unpaid", "return window", "exchange days"],
  },
  {
    id: "set-promos",
    group: "Settings & Features",
    label: "Promo codes & discount coupons",
    hint: "Create, enable/disable & delete checkout coupon codes",
    href: "/admin/settings?section=promos",
    icon: TicketPercentIcon,
    badge: "Promos",
    keywords: ["promo", "coupon", "discount", "voucher", "offer", "code", "percent", "flat"],
  },
  {
    id: "set-email-smtp",
    group: "Settings & Features",
    label: "Email & Gmail SMTP notifications",
    hint: "Configure Gmail SMTP app password & send test emails",
    href: "/admin/settings?section=email",
    icon: MailIcon,
    badge: "Email",
    keywords: ["email", "smtp", "gmail", "app password", "mail", "notification", "test email"],
  },
  {
    id: "feat-pin-lock",
    group: "Settings & Features",
    label: "4-digit Quick PIN lock",
    hint: "Set, change or disable quick screen lock in My Account",
    href: "/admin/account?section=pin",
    icon: ShieldCheckIcon,
    badge: "Security",
    keywords: ["pin", "quick pin", "screen lock", "unlock", "security", "4 digit"],
  },
  {
    id: "feat-admin-email",
    group: "Settings & Features",
    label: "Change admin login email",
    hint: "Update sign-in email address in My Account",
    href: "/admin/account?section=email",
    icon: MailIcon,
    badge: "Account",
    keywords: ["admin email", "login email", "change email", "account email"],
  },
  {
    id: "feat-password",
    group: "Settings & Features",
    label: "Change admin password",
    hint: "Update login password in My Account",
    href: "/admin/account?section=password",
    icon: KeyRoundIcon,
    badge: "Security",
    keywords: ["password", "login", "credentials", "reset password"],
  },
]

const QUICK_SUGGESTIONS = ["Orders", "Products", "GST", "UPI", "Delivery", "Promos"]

const SKELETON_ROWS = [
  { id: "sk-1", title: "Order #KK-1042 · Customer name", hint: "₹1,499 · Confirmed · Paid" },
  { id: "sk-2", title: "Handcrafted Brass Accent Piece", hint: "₹2,299 · 12 in stock" },
  { id: "sk-3", title: "Home Decor Collection", hint: "/home-decor-collection" },
]

type FlatRow = {
  key: string
  href: string
  external?: boolean
}

type LiveSearchState = {
  query: string
  data: AdminGlobalSearchResults
  error: string | null
}

const EMPTY_LIVE: AdminGlobalSearchResults = {
  orders: [],
  products: [],
  categories: [],
  promos: [],
}

const INITIAL_LIVE_STATE: LiveSearchState = {
  query: "",
  data: EMPTY_LIVE,
  error: null,
}

const MAX_CACHE_ENTRIES = 40
const adminSearchCache = new Map<string, AdminGlobalSearchResults>()

function scoreStaticItem(item: StaticSearchItem, tokens: string[]): number | null {
  const label = item.label.toLowerCase()
  const hint = item.hint.toLowerCase()
  const badge = (item.badge ?? "").toLowerCase()
  const keywords = item.keywords.join(" ").toLowerCase()
  const haystack = `${label} ${hint} ${badge} ${keywords}`

  let score = 0
  for (const token of tokens) {
    if (!haystack.includes(token)) return null
    if (label.startsWith(token)) score += 12
    else if (label.includes(token)) score += 8
    else if (item.keywords.some((k) => k.toLowerCase().startsWith(token))) score += 6
    else score += 3
  }
  return score
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function HighlightText({ text, query }: { text: string; query: string }) {
  const tokens = query
    .trim()
    .split(/\s+/)
    .filter((t) => t.length >= 2)
  if (tokens.length === 0) return <>{text}</>
  const pattern = new RegExp(`(${tokens.map(escapeRegExp).join("|")})`, "gi")
  const parts = text.split(pattern)
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <mark key={i} className={styles.matchMark}>
            {part}
          </mark>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        )
      )}
    </>
  )
}

function LiveSearchSkeleton() {
  return (
    <Skeletonize label="Searching records">
      <section className={styles.resultGroup}>
        <p className={styles.groupHeading}>Searching records</p>
        <ul role="list" className={styles.resultList}>
          {SKELETON_ROWS.map((row) => (
            <li key={row.id}>
              <div className={styles.resultRow}>
                <div className={styles.resultIconWrap} data-skeleton-block="">
                  <ShoppingCartIcon className={styles.icon16} />
                </div>
                <div className={styles.resultTextCol}>
                  <p className={styles.resultLabel}>{row.title}</p>
                  <p className={styles.resultHint}>{row.hint}</p>
                </div>
                <ChevronRightIcon className={styles.chevronIcon} />
              </div>
            </li>
          ))}
        </ul>
      </section>
    </Skeletonize>
  )
}

export function AdminGlobalSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter()
  const inputId = useId()
  const [query, setQuery] = useState("")
  const [liveState, setLiveState] = useState<LiveSearchState>(INITIAL_LIVE_STATE)
  const [retryNonce, setRetryNonce] = useState(0)
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const reqIdRef = useRef(0)

  const resetState = useCallback(() => {
    reqIdRef.current++
    setQuery("")
    setLiveState(INITIAL_LIVE_STATE)
    setActiveKey(null)
  }, [])

  const closeAndReset = useCallback(() => {
    onOpenChange(false)
    resetState()
  }, [onOpenChange, resetState])

  // Listen to ⌘K / Ctrl+K, custom open event, and admin PIN lock events
  useEffect(() => {
    const isPinLocked = () => Boolean(document.querySelector("[data-admin-pin-locked]"))
    const isEditableTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false
      const tag = target.tagName
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        if (isPinLocked()) return
        if (!open && isEditableTarget(e.target)) return
        if (!open && document.querySelector("[role=\"dialog\"]")) return
        e.preventDefault()
        if (open) closeAndReset()
        else onOpenChange(true)
      }
    }
    const onOpenEvent = () => {
      if (isPinLocked()) return
      onOpenChange(true)
    }
    const onPinChanged = (e: Event) => {
      const detail = (e as CustomEvent<{ manualLock?: boolean }>).detail
      if (detail?.manualLock) {
        adminSearchCache.clear()
        closeAndReset()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    window.addEventListener(OPEN_ADMIN_SEARCH_EVENT, onOpenEvent)
    window.addEventListener("kk-admin-pin-changed", onPinChanged)
    return () => {
      window.removeEventListener("keydown", onKeyDown)
      window.removeEventListener(OPEN_ADMIN_SEARCH_EVENT, onOpenEvent)
      window.removeEventListener("kk-admin-pin-changed", onPinChanged)
    }
  }, [open, onOpenChange, closeAndReset])

  // Clear per-session cache whenever the search palette opens so live orders/stock are always fresh
  useEffect(() => {
    if (open) {
      adminSearchCache.clear()
    }
  }, [open])

  const trimmedQuery = query.trim()
  const cacheKey = trimmedQuery.toLowerCase()
  const needsLive = trimmedQuery.length >= 2
  const cachedForQuery = needsLive ? adminSearchCache.get(cacheKey) : undefined
  const activeLive: AdminGlobalSearchResults = !needsLive
    ? EMPTY_LIVE
    : cachedForQuery ?? (liveState.query === trimmedQuery ? liveState.data : EMPTY_LIVE)
  const isLiveLoading = open && needsLive && !cachedForQuery && liveState.query !== trimmedQuery
  const liveErrorMessage =
    open && needsLive && !cachedForQuery && liveState.query === trimmedQuery ? liveState.error : null
  const hasLiveError = Boolean(liveErrorMessage)

  // Debounced live DB search for orders, products, categories & promo codes
  useEffect(() => {
    if (!open || !needsLive || adminSearchCache.has(cacheKey)) {
      reqIdRef.current++
      return
    }

    let cancelled = false
    const currentReq = ++reqIdRef.current
    const timer = window.setTimeout(async () => {
      try {
        const res = await searchAdminGlobal(trimmedQuery)
        if (cancelled || reqIdRef.current !== currentReq) return
        if (!res.ok) {
          if (res.locked) {
            adminSearchCache.clear()
            closeAndReset()
            toast.error(res.error)
            return
          }
          setLiveState({ query: trimmedQuery, data: EMPTY_LIVE, error: res.error })
          return
        }
        if (adminSearchCache.size >= MAX_CACHE_ENTRIES) {
          const oldest = adminSearchCache.keys().next().value
          if (oldest !== undefined) adminSearchCache.delete(oldest)
        }
        adminSearchCache.set(cacheKey, res.data)
        setLiveState({ query: trimmedQuery, data: res.data, error: null })
      } catch {
        if (!cancelled && reqIdRef.current === currentReq) {
          setLiveState({
            query: trimmedQuery,
            data: EMPTY_LIVE,
            error: "Couldn't search live orders & products.",
          })
        }
      }
    }, 180)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [open, needsLive, trimmedQuery, cacheKey, retryNonce, closeAndReset])

  const { pagesMatches, settingsMatches } = useMemo(() => {
    const trimmed = query.trim().toLowerCase()
    if (!trimmed) {
      return {
        pagesMatches: STATIC_ADMIN_INDEX.filter((i) => i.group === "Pages & Actions").slice(0, 7),
        settingsMatches: STATIC_ADMIN_INDEX.filter((i) => i.group === "Settings & Features").slice(0, 6),
      }
    }
    const tokens = trimmed.split(/\s+/).filter(Boolean)
    const scored = STATIC_ADMIN_INDEX.map((item) => ({ item, score: scoreStaticItem(item, tokens) }))
      .filter((x): x is { item: StaticSearchItem; score: number } => x.score !== null)
      .sort((a, b) => b.score - a.score)

    return {
      pagesMatches: scored.filter((x) => x.item.group === "Pages & Actions").map((x) => x.item),
      settingsMatches: scored.filter((x) => x.item.group === "Settings & Features").map((x) => x.item),
    }
  }, [query])

  const flatRows = useMemo<FlatRow[]>(() => {
    const rows: FlatRow[] = []
    for (const o of activeLive.orders) rows.push({ key: `order-${o.id}`, href: `/admin/orders/${encodeURIComponent(o.orderCode)}` })
    for (const p of activeLive.products) rows.push({ key: `prod-${p.id}`, href: `/admin/products/${p.id}` })
    for (const c of activeLive.categories) rows.push({ key: `cat-${c.id}`, href: "/admin/categories" })
    for (const pc of activeLive.promos) rows.push({ key: `promo-${pc.id}`, href: "/admin/settings?section=promos" })
    for (const s of settingsMatches) rows.push({ key: s.id, href: s.href, external: s.external })
    for (const p of pagesMatches) rows.push({ key: p.id, href: p.href, external: p.external })
    return rows
  }, [activeLive, settingsMatches, pagesMatches])

  const clampedActive = useMemo(() => {
    if (flatRows.length === 0) return 0
    if (activeKey) {
      const idx = flatRows.findIndex((r) => r.key === activeKey)
      if (idx >= 0) return idx
    }
    return 0
  }, [flatRows, activeKey])

  // Keep keyboard-selected row visible while navigating with ArrowUp / ArrowDown
  const scrollRowIntoView = useCallback((nextIdx: number) => {
    const el = bodyRef.current?.querySelector<HTMLElement>(`[data-search-row-idx="${nextIdx}"]`)
    el?.scrollIntoView({ block: "nearest" })
  }, [])

  const handleClear = useCallback(() => {
    resetState()
    inputRef.current?.focus()
  }, [resetState])

  const handleRetry = useCallback(() => {
    adminSearchCache.delete(cacheKey)
    setLiveState(INITIAL_LIVE_STATE)
    setRetryNonce((n) => n + 1)
  }, [cacheKey])

  const navigateToRow = (row: FlatRow) => {
    closeAndReset()
    if (row.external) {
      window.open(row.href, "_blank", "noopener,noreferrer")
    } else {
      router.push(row.href)
    }
  }

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      if (flatRows.length > 0) {
        const next = (clampedActive + 1) % flatRows.length
        setActiveKey(flatRows[next].key)
        scrollRowIntoView(next)
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      if (flatRows.length > 0) {
        const next = (clampedActive - 1 + flatRows.length) % flatRows.length
        setActiveKey(flatRows[next].key)
        scrollRowIntoView(next)
      }
    } else if (e.key === "Enter" && flatRows[clampedActive]) {
      e.preventDefault()
      navigateToRow(flatRows[clampedActive])
    }
  }

  const hasStaticMatches = settingsMatches.length > 0 || pagesMatches.length > 0
  const hasLiveMatches =
    activeLive.orders.length > 0 ||
    activeLive.products.length > 0 ||
    activeLive.categories.length > 0 ||
    activeLive.promos.length > 0
  const hasAnyResults = flatRows.length > 0
  const showFullSkeleton = isLiveLoading && !hasStaticMatches && !hasLiveMatches
  const showInlineLiveCheck = isLiveLoading && (hasStaticMatches || hasLiveMatches)
  const isSingleCharMiss = trimmedQuery.length === 1 && !hasAnyResults
  const showEmptyState = !hasAnyResults && !isLiveLoading && !hasLiveError && !isSingleCharMiss
  const settledAnnouncement =
    trimmedQuery.length >= 2 && !isLiveLoading
      ? hasAnyResults
        ? `${flatRows.length} ${flatRows.length === 1 ? "result" : "results"} found for ${trimmedQuery}`
        : `No matches for ${trimmedQuery}`
      : ""

  let rowCursor = 0

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) resetState()
        onOpenChange(next)
      }}
    >
      <DialogContent mobileFullScreen className={styles.searchDialogContent}>
        <DialogTitle className={styles.srOnly}>Search admin</DialogTitle>
        <DialogDescription className={styles.srOnly}>
          Search orders, products, categories, promo codes, settings, and admin features
        </DialogDescription>

        <div className={styles.searchInputBar}>
          <button
            type="button"
            onClick={closeAndReset}
            aria-label="Back"
            className={styles.mobileBackBtn}
          >
            <ArrowLeftIcon className={styles.icon20} aria-hidden="true" />
          </button>

          <div className={styles.searchFieldWrap}>
            <label htmlFor={inputId} className={styles.srOnly}>
              Search admin orders, products, categories, promo codes, and settings
            </label>
            {isLiveLoading ? (
              <Loader2Icon className={styles.searchSpinner} aria-hidden="true" />
            ) : (
              <SearchIcon className={styles.searchLeadIcon} aria-hidden="true" />
            )}
            <input
              id={inputId}
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setActiveKey(null)
              }}
              onKeyDown={handleInputKeyDown}
              placeholder="Search orders, products, GST, UPI, promos…"
              autoComplete="off"
              spellCheck={false}
              autoFocus
              className={styles.searchInput}
            />
            {query.length > 0 && (
              <button
                type="button"
                onClick={handleClear}
                aria-label="Clear search query"
                className={styles.clearTextBtn}
              >
                Clear
              </button>
            )}
          </div>

          <span className={styles.barDivider} aria-hidden="true" />

          <button
            type="button"
            onClick={closeAndReset}
            aria-label="Close search"
            className={styles.desktopCloseBtn}
          >
            <XIcon className={styles.icon16} aria-hidden="true" />
          </button>
        </div>

        <DialogBody className={styles.searchResultsBody} aria-busy={isLiveLoading}>
          <div ref={bodyRef} className={styles.resultsInner}>
            <span role="status" aria-live="polite" className={styles.srOnly}>
              {settledAnnouncement}
            </span>

            {isSingleCharMiss ? (
              <div className={styles.emptyState}>
                <SearchIcon className={styles.emptyIcon} aria-hidden="true" />
                <p className={styles.emptyTitle}>Keep typing to search records</p>
                <p className={styles.emptySub}>
                  Enter at least 2 characters to search live orders, customer names, products, SKUs, and promo codes.
                </p>
              </div>
            ) : showEmptyState ? (
              <div className={styles.emptyState}>
                <SearchXIcon className={styles.emptyIcon} aria-hidden="true" />
                <p className={styles.emptyTitle}>No matches for “{trimmedQuery}”</p>
                <p className={styles.emptySub}>
                  Try an order code, customer phone, product name, SKU, or jump to a common area below.
                </p>
                <div className={styles.suggestionRow}>
                  {QUICK_SUGGESTIONS.map((term) => (
                    <button
                      key={term}
                      type="button"
                      onClick={() => {
                        setQuery(term)
                        setActiveKey(null)
                        inputRef.current?.focus()
                      }}
                      className={styles.suggestionChip}
                    >
                      {term}
                    </button>
                  ))}
                </div>
                <button type="button" onClick={handleClear} className={styles.emptyClearBtn}>
                  Clear search
                </button>
              </div>
            ) : (
              <div className={styles.groupsStack}>
                {showFullSkeleton && <LiveSearchSkeleton />}

                {hasLiveError && (
                  <div role="alert" className={styles.liveErrorBanner}>
                    <span className={styles.liveErrorText}>{liveErrorMessage}</span>
                    <button type="button" onClick={handleRetry} className={styles.retryBtn}>
                      <RefreshCwIcon className={styles.icon14} aria-hidden="true" />
                      Retry
                    </button>
                  </div>
                )}

                {activeLive.orders.length > 0 && (
                  <section className={styles.resultGroup}>
                    <div className={styles.groupHeaderRow}>
                      <p className={styles.groupHeading}>Orders</p>
                      <span className={styles.groupCount}>{activeLive.orders.length}</span>
                    </div>
                    <ul role="list" className={styles.resultList}>
                      {activeLive.orders.map((o) => {
                        const idx = rowCursor++
                        const href = `/admin/orders/${encodeURIComponent(o.orderCode)}`
                        return (
                          <li key={`order-${o.id}`}>
                            <Link
                              href={href}
                              data-search-row-idx={idx}
                              onClick={closeAndReset}
                              onMouseEnter={() => setActiveKey(flatRows[idx]?.key ?? null)}
                              className={cn(styles.resultRow, idx === clampedActive && styles.resultRowActive)}
                            >
                              <span className={styles.resultIconWrap} aria-hidden="true">
                                <ShoppingCartIcon className={styles.icon16} />
                              </span>
                              <span className={styles.resultTextCol}>
                                <span className={styles.resultLabel}>
                                  <HighlightText text={`${o.orderCode} · ${o.customerName}`} query={trimmedQuery} />
                                </span>
                                <span className={styles.resultHint}>
                                  {formatPrice(o.total)} · {o.status} · {o.paymentStatus}
                                </span>
                              </span>
                              <ChevronRightIcon className={styles.chevronIcon} aria-hidden="true" />
                            </Link>
                          </li>
                        )
                      })}
                    </ul>
                  </section>
                )}

                {activeLive.products.length > 0 && (
                  <section className={styles.resultGroup}>
                    <div className={styles.groupHeaderRow}>
                      <p className={styles.groupHeading}>Products</p>
                      <span className={styles.groupCount}>{activeLive.products.length}</span>
                    </div>
                    <ul role="list" className={styles.resultList}>
                      {activeLive.products.map((p) => {
                        const idx = rowCursor++
                        const href = `/admin/products/${p.id}`
                        return (
                          <li key={`prod-${p.id}`}>
                            <Link
                              href={href}
                              data-search-row-idx={idx}
                              onClick={closeAndReset}
                              onMouseEnter={() => setActiveKey(flatRows[idx]?.key ?? null)}
                              className={cn(styles.resultRow, idx === clampedActive && styles.resultRowActive)}
                            >
                              <span className={styles.resultIconWrap} aria-hidden="true">
                                <PackageIcon className={styles.icon16} />
                              </span>
                              <span className={styles.resultTextCol}>
                                <span className={styles.resultLabel}>
                                  <HighlightText text={p.name} query={trimmedQuery} />
                                </span>
                                <span className={styles.resultHint}>
                                  {formatPrice(p.price)} · {p.stock > 0 ? `${p.stock} in stock` : "Out of stock"}
                                  {!p.isActive ? " · Hidden" : ""}
                                </span>
                              </span>
                              <ChevronRightIcon className={styles.chevronIcon} aria-hidden="true" />
                            </Link>
                          </li>
                        )
                      })}
                    </ul>
                  </section>
                )}

                {activeLive.categories.length > 0 && (
                  <section className={styles.resultGroup}>
                    <div className={styles.groupHeaderRow}>
                      <p className={styles.groupHeading}>Categories</p>
                      <span className={styles.groupCount}>{activeLive.categories.length}</span>
                    </div>
                    <ul role="list" className={styles.resultList}>
                      {activeLive.categories.map((c) => {
                        const idx = rowCursor++
                        return (
                          <li key={`cat-${c.id}`}>
                            <Link
                              href="/admin/categories"
                              data-search-row-idx={idx}
                              onClick={closeAndReset}
                              onMouseEnter={() => setActiveKey(flatRows[idx]?.key ?? null)}
                              className={cn(styles.resultRow, idx === clampedActive && styles.resultRowActive)}
                            >
                              <span className={styles.resultIconWrap} aria-hidden="true">
                                <TagsIcon className={styles.icon16} />
                              </span>
                              <span className={styles.resultTextCol}>
                                <span className={styles.resultLabel}>
                                  <HighlightText text={c.name} query={trimmedQuery} />
                                </span>
                                <span className={styles.resultHint}>/{c.slug}</span>
                              </span>
                              <ChevronRightIcon className={styles.chevronIcon} aria-hidden="true" />
                            </Link>
                          </li>
                        )
                      })}
                    </ul>
                  </section>
                )}

                {activeLive.promos.length > 0 && (
                  <section className={styles.resultGroup}>
                    <div className={styles.groupHeaderRow}>
                      <p className={styles.groupHeading}>Promo codes</p>
                      <span className={styles.groupCount}>{activeLive.promos.length}</span>
                    </div>
                    <ul role="list" className={styles.resultList}>
                      {activeLive.promos.map((pc) => {
                        const idx = rowCursor++
                        return (
                          <li key={`promo-${pc.id}`}>
                            <Link
                              href="/admin/settings?section=promos"
                              data-search-row-idx={idx}
                              onClick={closeAndReset}
                              onMouseEnter={() => setActiveKey(flatRows[idx]?.key ?? null)}
                              className={cn(styles.resultRow, idx === clampedActive && styles.resultRowActive)}
                            >
                              <span className={styles.resultIconWrap} aria-hidden="true">
                                <TicketPercentIcon className={styles.icon16} />
                              </span>
                              <span className={styles.resultTextCol}>
                                <span className={styles.resultLabel}>
                                  <HighlightText text={pc.code} query={trimmedQuery} />
                                </span>
                                <span className={styles.resultHint}>
                                  {pc.discountType === "percent" ? `${pc.discountValue}% off` : `${formatPrice(pc.discountValue)} off`} ·{" "}
                                  {pc.isActive ? "Active" : "Paused"}
                                </span>
                              </span>
                              <ChevronRightIcon className={styles.chevronIcon} aria-hidden="true" />
                            </Link>
                          </li>
                        )
                      })}
                    </ul>
                  </section>
                )}

                {settingsMatches.length > 0 && (
                  <section className={styles.resultGroup}>
                    <div className={styles.groupHeaderRow}>
                      <p className={styles.groupHeading}>Settings &amp; features</p>
                      {trimmedQuery.length > 0 && <span className={styles.groupCount}>{settingsMatches.length}</span>}
                    </div>
                    <ul role="list" className={styles.resultList}>
                      {settingsMatches.map((item) => {
                        const idx = rowCursor++
                        const Icon = item.icon
                        return (
                          <li key={item.id}>
                            <Link
                              href={item.href}
                              data-search-row-idx={idx}
                              onClick={closeAndReset}
                              onMouseEnter={() => setActiveKey(flatRows[idx]?.key ?? null)}
                              className={cn(styles.resultRow, idx === clampedActive && styles.resultRowActive)}
                            >
                              <span className={styles.resultIconWrap} aria-hidden="true">
                                <Icon className={styles.icon16} />
                              </span>
                              <span className={styles.resultTextCol}>
                                <span className={styles.resultLabel}>
                                  <HighlightText text={item.label} query={trimmedQuery} />
                                </span>
                                <span className={styles.resultHint}>{item.hint}</span>
                              </span>
                              {item.badge && <span className={styles.resultBadge}>{item.badge}</span>}
                            </Link>
                          </li>
                        )
                      })}
                    </ul>
                  </section>
                )}

                {pagesMatches.length > 0 && (
                  <section className={styles.resultGroup}>
                    <div className={styles.groupHeaderRow}>
                      <p className={styles.groupHeading}>Pages &amp; actions</p>
                      {trimmedQuery.length > 0 && <span className={styles.groupCount}>{pagesMatches.length}</span>}
                    </div>
                    <ul role="list" className={styles.resultList}>
                      {pagesMatches.map((item) => {
                        const idx = rowCursor++
                        const Icon = item.icon
                        return (
                          <li key={item.id}>
                            <Link
                              href={item.href}
                              target={item.external ? "_blank" : undefined}
                              rel={item.external ? "noopener noreferrer" : undefined}
                              data-search-row-idx={idx}
                              onClick={closeAndReset}
                              onMouseEnter={() => setActiveKey(flatRows[idx]?.key ?? null)}
                              className={cn(styles.resultRow, idx === clampedActive && styles.resultRowActive)}
                            >
                              <span className={styles.resultIconWrap} aria-hidden="true">
                                <Icon className={styles.icon16} />
                              </span>
                              <span className={styles.resultTextCol}>
                                <span className={styles.resultLabel}>
                                  <HighlightText text={item.label} query={trimmedQuery} />
                                </span>
                                <span className={styles.resultHint}>{item.hint}</span>
                              </span>
                              {item.badge && <span className={styles.resultBadge}>{item.badge}</span>}
                            </Link>
                          </li>
                        )
                      })}
                    </ul>
                  </section>
                )}

                {showInlineLiveCheck && (
                  <div className={styles.inlineLiveStatus}>
                    <Loader2Icon className={styles.inlineLiveSpinner} aria-hidden="true" />
                    <span>Checking live orders, products &amp; promos…</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}
