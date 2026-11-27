"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowLeftIcon, ArrowRightIcon, BellRingIcon, CheckCircle2Icon, CheckIcon, Loader2Icon, MessageSquarePlusIcon, PackageXIcon, PencilIcon, RotateCcwIcon, ShoppingBagIcon, SparklesIcon, StarIcon, ThumbsDownIcon, ThumbsUpIcon, Trash2Icon } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createContext, useContext, useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { SearchField, SelectField, TextAreaField, TextField } from "@/components/form"
import { useBlockWhile } from "@/components/shared/busy-overlay"
import { Carousel } from "@/components/shared/carousel"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { Breadcrumbs } from "@/components/store/page-header"
import { Button, buttonVariants } from "@/components/ui/button"
import { useToastAfter } from "@/hooks/use-toast-after"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { deleteProductReview, getMyProductReviewState, submitProductReview, subscribeStockAlert } from "@/features/products/actions"
import { productReviewSchema, type ProductReviewInput, type ProductReviewValues } from "@/features/products/schema"
import { extractVariantOptionGroups, isBackInStock, type Product, type ProductReview } from "@/features/products/types"
import { discountPercent, formatDate, formatPrice, formatRating, normalizeIndianPhone } from "@/lib/format"
import { cn } from "@/lib/utils"
import { LIMITS } from "@/lib/validation"
import { useAuth } from "@/store/auth"
import { cartLineKey, MAX_QTY_PER_ITEM, useCart } from "@/store/cart"
import { ProductImage } from "./product-image"
import { QuantityStepper } from "./quantity-stepper"
import { WishlistButton } from "./wishlist-button"
import styles from "./product-actions.module.css"

const STOCK_ALERT_STORAGE_KEY = "kk-stock-alerts"

function readSavedStockAlerts(): string[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(STOCK_ALERT_STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : []
  } catch {
    return []
  }
}

function saveStockAlertId(productId: string) {
  if (typeof window === "undefined") return
  try {
    const set = new Set(readSavedStockAlerts())
    set.add(productId)
    window.localStorage.setItem(STOCK_ALERT_STORAGE_KEY, JSON.stringify(Array.from(set).slice(-50)))
  } catch {}
}

type ProductVariantCtxValue = {
  selectedVariantId: string
  setSelectedVariantId: (id: string) => void
  activePrice: number
  activeCompareAt: number | null
}

const ProductVariantContext = createContext<ProductVariantCtxValue | null>(null)

/**
 * Shared client context on the Product Detail Page so selecting a Color / Size variant
 * updates the top hero price (`mainPriceText`, `comparePriceText`, `Save X%`) AND the Buy Box in sync.
 */
export function ProductVariantProvider({
  product,
  children,
}: {
  product: Pick<Product, "price" | "compareAtPrice" | "variants">
  children: ReactNode
}) {
  const variants = product.variants ?? []
  const hasVariants = variants.length > 0
  const [selectedVariantId, setSelectedVariantId] = useState<string>(() => {
    if (!hasVariants) return ""
    return (variants.find((v) => v.stock > 0) ?? variants[0]).id
  })
  const activeVariant = hasVariants ? (variants.find((v) => v.id === selectedVariantId) ?? variants[0]) : null
  const activePrice = activeVariant ? activeVariant.price : product.price
  const activeCompareAt = activeVariant ? (activeVariant.compareAtPrice ?? null) : product.compareAtPrice

  const value = useMemo(
    () => ({ selectedVariantId, setSelectedVariantId, activePrice, activeCompareAt }),
    [selectedVariantId, activePrice, activeCompareAt]
  )

  return <ProductVariantContext.Provider value={value}>{children}</ProductVariantContext.Provider>
}

/** Live-updating top hero price row on the Product Detail Page (reflects selected variant instantly). */
export function ProductLivePriceHeader({
  product,
  styles: pdpStyles,
}: {
  product: Pick<Product, "price" | "compareAtPrice" | "ratingAvg" | "reviewCount">
  styles: Readonly<Record<string, string>>
}) {
  const ctx = useContext(ProductVariantContext)
  const price = ctx ? ctx.activePrice : product.price
  const compareAt = ctx ? ctx.activeCompareAt : product.compareAtPrice
  const off = discountPercent(price, compareAt)

  return (
    <div className={pdpStyles.priceHeaderRow}>
      <span className={pdpStyles.mainPriceText}>{formatPrice(price)}</span>
      {compareAt && compareAt > price && (
        <span className={pdpStyles.comparePriceText}>{formatPrice(compareAt)}</span>
      )}
      {off && <span className={pdpStyles.saveBadge}>Save {off}%</span>}
      {(product.reviewCount ?? 0) > 0 && (
        <a href="#customer-reviews" className={pdpStyles.reviewsAnchorPill}>
          <StarIcon className={pdpStyles.starGoldIcon} aria-hidden />
          <span className={pdpStyles.ratingScoreText}>{formatRating(Number(product.ratingAvg ?? 0))}</span>
          <span className={pdpStyles.ratingCountText}>({product.reviewCount})</span>
        </a>
      )}
    </div>
  )
}

export function ProductActions({
  product,
}: {
  product: Pick<Product, "id" | "slug" | "name" | "price" | "compareAtPrice" | "images" | "stock" | "restockedAt" | "variants">
}) {
  const router = useRouter()
  const { user } = useAuth()
  const add = useCart((s) => s.add)
  const setOpen = useCart((s) => s.setOpen)
  const variantCtx = useContext(ProductVariantContext)
  const variants = product.variants ?? []
  const hasVariants = variants.length > 0
  const [localVariantId, setLocalVariantId] = useState<string>(() => {
    if (!hasVariants) return ""
    return (variants.find((v) => v.stock > 0) ?? variants[0]).id
  })
  const selectedVariantId = variantCtx ? variantCtx.selectedVariantId : localVariantId
  const setSelectedVariantId = variantCtx ? variantCtx.setSelectedVariantId : setLocalVariantId
  const activeVariant = hasVariants ? (variants.find((v) => v.id === selectedVariantId) ?? variants[0]) : null
  const activePrice = activeVariant ? activeVariant.price : product.price
  const activeCompareAt = activeVariant ? (activeVariant.compareAtPrice ?? null) : product.compareAtPrice
  const activeStock = activeVariant ? activeVariant.stock : product.stock
  const activeLineKey = cartLineKey({ productId: product.id, variantId: activeVariant?.id })
  const inCart = useCart((s) => s.items.find((i) => cartLineKey(i) === activeLineKey)?.quantity ?? 0)
  const [chosen, setChosen] = useState(1)
  const [clientNow, setClientNow] = useState<number | undefined>(undefined)
  const [notifyOpen, setNotifyOpen] = useState(false)
  const [alreadyNotified, setAlreadyNotified] = useState(false)
  const [notifyName, setNotifyName] = useState("")
  const [notifyPhone, setNotifyPhone] = useState("")
  const [notifyPhoneError, setNotifyPhoneError] = useState<string | null>(null)
  const [notifyPending, startNotifyTransition] = useTransition()
  useBlockWhile(notifyPending)
  const soldOut = activeStock <= 0
  const backInStock = clientNow !== undefined && isBackInStock({ stock: activeStock, restockedAt: product.restockedAt }, clientNow)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate client clock & local notify state after mount
    setClientNow(Date.now())
    if (soldOut) {
      setAlreadyNotified(readSavedStockAlerts().includes(product.id))
    } else {
      setAlreadyNotified(false)
    }
  }, [product.id, soldOut])

  const openNotifyDialog = () => {
    setNotifyName((prev) => prev || user?.name?.trim() || "")
    setNotifyPhoneError(null)
    setNotifyOpen(true)
  }

  const handleNotifySubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const cleanPhone = normalizeIndianPhone(notifyPhone)
    if (!cleanPhone) {
      setNotifyPhoneError("Enter a valid 10-digit WhatsApp / mobile number")
      return
    }
    setNotifyPhoneError(null)
    startNotifyTransition(async () => {
      const res = await subscribeStockAlert({
        productId: product.id,
        name: notifyName.trim(),
        phone: cleanPhone,
      })
      if (!res.ok) {
        if (res.fieldErrors?.phone?.[0]) setNotifyPhoneError(res.fieldErrors.phone[0])
        toast.error(res.error)
        return
      }
      saveStockAlertId(product.id)
      setAlreadyNotified(true)
      setNotifyOpen(false)
      setNotifyPhone("")
      setNotifyPhoneError(null)
      toast.success(
        res.data.alreadySubscribed
          ? "You're already on the notify list! We'll message you on WhatsApp as soon as it's back."
          : "Alert saved! We'll notify you on WhatsApp as soon as this piece is back in stock."
      )
    })
  }

  const max = Math.min(activeStock, MAX_QTY_PER_ITEM)
  // stock can drop while the page is open: never show or add more than can be bought
  const qty = Math.max(1, Math.min(chosen, max))
  const addToCart = () => {
    const unit = max === 1 ? "item" : "items"
    if (inCart > 0 && inCart + qty > max) {
      toast.info(
        inCart >= max
          ? `You already have all ${max} available ${unit} in your cart.`
          : `Only ${max} ${unit} available (${inCart} already in cart), so your cart is set to ${max}.`
      )
    }
    add(line, qty)
  }

  const buyNow = () => {
    add(line, qty)
    setOpen(false)
    router.push("/checkout")
  }

const COLOR_SWATCH_MAP: Record<string, string> = {
  black: "#18181b",
  white: "#fafafa",
  red: "#dc2626",
  blue: "#2563eb",
  navy: "#1e3a8a",
  green: "#16a34a",
  olive: "#4d7c0f",
  yellow: "#eab308",
  gold: "#d97706",
  orange: "#ea580c",
  pink: "#ec4899",
  rose: "#e11d48",
  purple: "#7c3aed",
  lavender: "#a78bfa",
  brown: "#78350f",
  beige: "#d6c7ae",
  cream: "#fef3c7",
  ivory: "#fffbeb",
  grey: "#6b7280",
  gray: "#6b7280",
  silver: "#cbd5e1",
  maroon: "#7f1d1d",
  terracotta: "#b85c38",
  teal: "#0d9488",
  cyan: "#06b6d4",
}

function swatchHexForOption(groupName: string, value: string): string | null {
  if (!/colou?r|shade|finish/i.test(groupName)) return null
  const lower = value.trim().toLowerCase()
  if (COLOR_SWATCH_MAP[lower]) return COLOR_SWATCH_MAP[lower]
  for (const [key, hex] of Object.entries(COLOR_SWATCH_MAP)) {
    if (lower.includes(key)) return hex
  }
  return null
}

  const line = {
    productId: product.id,
    ...(activeVariant ? { variantId: activeVariant.id, variantLabel: activeVariant.label, variantSku: activeVariant.sku ?? null } : {}),
    slug: product.slug,
    name: product.name,
    price: activePrice,
    image: product.images[0] ?? null,
    maxQuantity: activeStock,
  }

  const optionGroups = hasVariants ? extractVariantOptionGroups(variants) : []
  const selectedOptions: Record<string, string> = activeVariant?.options ?? {}

  const selectAttributeValue = (groupName: string, value: string) => {
    const desired = { ...selectedOptions, [groupName]: value }
    // 1. Exact match for all currently selected attributes
    const exact = variants.find((v) =>
      v.options && Object.entries(desired).every(([k, val]) => v.options?.[k] === val)
    )
    if (exact) {
      setSelectedVariantId(exact.id)
      setChosen(1)
      return
    }
    // 2. Fallback: first in-stock variant with the newly clicked attribute value (or first matching variant)
    const candidates = variants.filter((v) => v.options?.[groupName] === value)
    const best = candidates.find((v) => v.stock > 0) ?? candidates[0]
    if (best) {
      setSelectedVariantId(best.id)
      setChosen(1)
    }
  }

  const variantPicker = hasVariants ? (
    <div className={styles.variantPickerBlock}>
      {optionGroups.length > 0 ? (
        <>
          <div className={styles.variantPriceTopRow}>
            <span className={styles.variantSelectedPriceWrap}>
              <span className={styles.variantSelectedPrice}>{formatPrice(activePrice)}</span>
              {activeCompareAt && activeCompareAt > activePrice && (
                <span className={styles.variantSelectedCompare}>{formatPrice(activeCompareAt)}</span>
              )}
            </span>
            <span className={styles.variantSelectedSummaryPill}>{activeVariant?.label}</span>
          </div>
          {optionGroups.map((group) => {
            const currentVal = selectedOptions[group.name] ?? ""
            return (
              <div key={group.name} className={styles.variantAxisGroup}>
                <span className={styles.variantPickerLabel}>
                  {group.name}: <strong className={styles.variantSelectedName}>{currentVal}</strong>
                </span>
                <div className={styles.variantPillsRow} role="radiogroup" aria-label={group.name}>
                  {group.values.map((val) => {
                    const isSelected = currentVal === val
                    const swatch = swatchHexForOption(group.name, val)
                    const matchingExact = variants.find((v) =>
                      v.options &&
                      v.options[group.name] === val &&
                      Object.entries(selectedOptions).every(([k, sVal]) => k === group.name || v.options?.[k] === sVal)
                    )
                    const anyStockForVal = variants.some((v) => v.options?.[group.name] === val && v.stock > 0)
                    const isOos = matchingExact ? matchingExact.stock <= 0 : !anyStockForVal
                    return (
                      <button
                        key={val}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        onClick={() => selectAttributeValue(group.name, val)}
                        className={cn(
                          styles.variantPillBtn,
                          isSelected && styles.variantPillSelected,
                          isOos && styles.variantPillOos
                        )}
                      >
                        {swatch && <span className={styles.variantColorDot} style={{ backgroundColor: swatch }} aria-hidden />}
                        <span className={cn(isOos && styles.variantOosStrike)}>{val}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </>
      ) : (
        <>
          <div className={styles.variantPickerHeader}>
            <span className={styles.variantPickerLabel}>
              Select option: <strong className={styles.variantSelectedName}>{activeVariant?.label}</strong>
            </span>
            <span className={styles.variantSelectedPriceWrap}>
              <span className={styles.variantSelectedPrice}>{formatPrice(activePrice)}</span>
              {activeCompareAt && activeCompareAt > activePrice && (
                <span className={styles.variantSelectedCompare}>{formatPrice(activeCompareAt)}</span>
              )}
            </span>
          </div>
          <div className={styles.variantPillsRow} role="radiogroup" aria-label="Product options">
            {variants.map((v) => {
              const isSelected = activeVariant?.id === v.id
              const isOos = v.stock <= 0
              return (
                <button
                  key={v.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => {
                    setSelectedVariantId(v.id)
                    setChosen(1)
                  }}
                  className={cn(
                    styles.variantPillBtn,
                    isSelected && styles.variantPillSelected,
                    isOos && styles.variantPillOos
                  )}
                >
                  <span className={cn(isOos && styles.variantOosStrike)}>{v.label}</span>
                  {isOos && <span className={styles.variantOosTag}>Sold out</span>}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  ) : null

  if (soldOut) {
    return (
      <div className={styles.actionsStack}>
        {variantPicker}
        <p role="status" className={styles.soldOutBanner}>
          <PackageXIcon className={styles.pkgXSvg} />
          <span>
            Sold out for now — get notified on WhatsApp the moment this item is back in stock.
          </span>
        </p>
        <div className={styles.soldOutRow}>
          {alreadyNotified ? (
            <Button type="button" size="lg" variant="outline" onClick={openNotifyDialog} className={styles.notifiedDoneBtn}>
              <CheckIcon className={styles.bagSvg18} /> You&apos;re on the notify list
            </Button>
          ) : (
            <Button type="button" size="lg" onClick={openNotifyDialog} className={styles.notifyMeBtn}>
              <BellRingIcon className={styles.bagSvg18} /> Notify me when back in stock
            </Button>
          )}
          <WishlistButton productId={product.id} productName={product.name} size="lg" className={styles.wishlistBtn52} />
        </div>

        {/* Native mobile sticky bottom notify bar when sold out */}
        <div data-mobile-bottom-bar className={cn(styles.mobileSoldOutBar, "glass")}>
          {alreadyNotified ? (
            <Button type="button" size="lg" variant="outline" onClick={openNotifyDialog} className={styles.mobileNotifiedBtn}>
              <CheckIcon className={styles.bagSvg18} /> On notify list
            </Button>
          ) : (
            <Button type="button" size="lg" onClick={openNotifyDialog} className={styles.mobileNotifyBtn}>
              <BellRingIcon className={styles.bagSvg18} /> Notify me when back
            </Button>
          )}
          <WishlistButton productId={product.id} productName={product.name} size="lg" className={styles.wishlistBtn52} />
        </div>

        <Dialog
          open={notifyOpen}
          onOpenChange={(next) => {
            if (notifyPending) return
            setNotifyOpen(next)
            if (!next) setNotifyPhoneError(null)
          }}
        >
          <DialogContent mobileFullScreen className={styles.notifyDialogModal}>
            <DialogHeader showCloseButton={!notifyPending}>
              <DialogTitle>Get notified when back in stock</DialogTitle>
              <DialogDescription>
                Leave your WhatsApp / mobile number and we&apos;ll alert you as soon as this piece is restocked.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleNotifySubmit} noValidate className={styles.reviewDialogForm}>
              <DialogBody className={styles.notifyDialogBody}>
                <div className={styles.productContextStrip}>
                  <div className={styles.contextThumb}>
                    <ProductImage src={product.images[0] ?? null} alt={product.name} sizes="48px" />
                  </div>
                  <div className={styles.contextInfoCol}>
                    <p className={styles.contextTitle}>
                      {activeVariant ? `${product.name} — ${activeVariant.label}` : product.name}
                    </p>
                    <p className={styles.contextSub}>{formatPrice(activePrice)} · Currently sold out</p>
                  </div>
                </div>

                <TextField
                  label="WhatsApp / mobile number *"
                  kind="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  leading="+91"
                  required
                  placeholder="98765 43210"
                  hint="We only use this to message you once when this item is back in stock."
                  value={notifyPhone}
                  onChange={(e) => {
                    setNotifyPhone(e.target.value)
                    if (notifyPhoneError) setNotifyPhoneError(null)
                  }}
                  error={notifyPhoneError ?? undefined}
                />
                <TextField
                  label="Your name (optional)"
                  kind="personName"
                  autoComplete="name"
                  placeholder="e.g. Priya"
                  value={notifyName}
                  onChange={(e) => setNotifyName(e.target.value)}
                />
              </DialogBody>
              <DialogFooter>
                <Button type="button" variant="outline" size="lg" disabled={notifyPending} onClick={() => setNotifyOpen(false)} className={styles.notifyCancelBtn}>
                  Cancel
                </Button>
                <Button type="submit" size="lg" disabled={notifyPending} className={styles.notifySubmitBtn}>
                  {notifyPending ? <Loader2Icon className={styles.spinSvg} /> : <BellRingIcon className={styles.bagSvg18} />}
                  {notifyPending ? "Saving…" : "Notify me on WhatsApp"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  return (
    <div className={styles.actionsStack}>
      {variantPicker}
      {backInStock && (
        <p role="status" className={styles.backInStockPill}>
          <SparklesIcon className={styles.backInStockIcon} aria-hidden />
          <span>Back in stock — Fresh batch just arrived!</span>
        </p>
      )}
      {activeStock <= 5 && (
        <p className={styles.lowStockAlert}>
          Only {activeStock} {activeStock === 1 ? "item" : "items"} left in stock
        </p>
      )}
      {/* Row 1: quantity | add to cart, 50 / 50. Row 2: buy now (the rest of the row) + wishlist. Every control is h-13. */}
      <div className={styles.stepperAndCartGrid}>
        <QuantityStepper label={product.name} value={qty} max={max} onChange={setChosen} size="lg" className={styles.stepperControl} />
        <WishlistButton productId={product.id} productName={product.name} size="lg" className={styles.mobileWishlistBtn} />
        <Button
          size="lg"
          variant="outline"
          className={styles.desktopAddToCartBtn}
          onClick={addToCart}
        >
          <ShoppingBagIcon className={styles.bagSvg20} /> Add to cart
        </Button>
      </div>
      <div className={styles.desktopBuyNowRow}>
        <Button
          size="lg"
          className={styles.buyNowWhatsappBtn}
          onClick={buyNow}
        >
          <span className={styles.buyBtnTopText}>Buy now</span>
          <span className={styles.buyBtnPriceLg}>{formatPrice(activePrice * qty)}</span>
        </Button>
        <WishlistButton productId={product.id} productName={product.name} size="lg" className={styles.wishlistBtn56} />
      </div>

      {/* Native Android e-commerce sticky bottom buy bar on phones */}
      <div

        data-mobile-bottom-bar
        className={cn(styles.mobileBuyBar, "glass")}
      >
        <Button

          size="lg"
          variant="outline"
          className={styles.mobileCartBtn}
          onClick={addToCart}
        >
          <ShoppingBagIcon className={styles.bagSvg18} /> Add to cart
        </Button>
        <Button

          size="lg"
          className={styles.mobileBuyBtn}
          onClick={buyNow}
        >
          <span className={styles.buyBtnTopText}>Buy now</span>
          <span className={styles.buyBtnPriceSm}>{formatPrice(activePrice * qty)}</span>
        </Button>
      </div>
    </div>
  )
}

const RATING_LABELS: Record<number, string> = {
  1: "Terrible",
  2: "Bad",
  3: "Okay",
  4: "Good",
  5: "Great",
}

const DEFAULT_REVIEW_ASPECTS = [
  "Build Quality",
  "Colour & Finish",
  "Material Quality",
  "Packaging",
  "Value for Money",
] as const

function resolveReviewAspects(product?: {
  reviewAspects?: readonly string[] | null
  category?: { reviewAspects?: readonly string[] | null } | null
}): readonly string[] {
  if (product?.reviewAspects && product.reviewAspects.length > 0) return product.reviewAspects
  if (product?.category?.reviewAspects && product.category.reviewAspects.length > 0) return product.category.reviewAspects
  return DEFAULT_REVIEW_ASPECTS
}

const LOVED_PREFIX = "Loved: "
const DISLIKED_PREFIX = "Disliked: "

type ReviewEligibilityState = {
  canReview: boolean
  isAdmin: boolean
  myReview: ProductReview | null
}

type PersistedReviewSnapshot = {
  userId: string
  isAdmin: boolean
  deliveredProductIds: string[]
  reviews: Record<string, ProductReview>
}

const REVIEW_SNAPSHOT_STORAGE_KEY = "kk-review-eligibility"
const reviewStateCache = new Map<string, ReviewEligibilityState>()
const reviewStateInFlight = new Map<string, Promise<ReviewEligibilityState>>()
let memorySnapshot: PersistedReviewSnapshot | null = null

function readPersistedSnapshot(userId: string): PersistedReviewSnapshot | null {
  if (memorySnapshot && memorySnapshot.userId === userId) return memorySnapshot
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(REVIEW_SNAPSHOT_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PersistedReviewSnapshot | null
    if (!parsed || parsed.userId !== userId) return null
    memorySnapshot = parsed
    return parsed
  } catch {
    return null
  }
}

function writePersistedSnapshot(snapshot: PersistedReviewSnapshot | null) {
  memorySnapshot = snapshot
  if (typeof window === "undefined") return
  try {
    if (!snapshot) {
      window.localStorage.removeItem(REVIEW_SNAPSHOT_STORAGE_KEY)
    } else {
      window.localStorage.setItem(REVIEW_SNAPSHOT_STORAGE_KEY, JSON.stringify(snapshot))
    }
  } catch {}
}

export function primeUserReviewStateCache(
  userId: string,
  data: { isAdmin: boolean; deliveredProductIds: string[]; reviews: ProductReview[] }
) {
  const reviewsMap: Record<string, ProductReview> = {}
  for (const r of data.reviews) {
    reviewsMap[r.productId] = r
  }
  const snapshot: PersistedReviewSnapshot = {
    userId,
    isAdmin: data.isAdmin,
    deliveredProductIds: data.deliveredProductIds,
    reviews: reviewsMap,
  }
  writePersistedSnapshot(snapshot)
  for (const pid of data.deliveredProductIds) {
    reviewStateCache.set(`${userId}:${pid}`, {
      canReview: true,
      isAdmin: data.isAdmin,
      myReview: reviewsMap[pid] ?? null,
    })
  }
  for (const r of data.reviews) {
    reviewStateCache.set(`${userId}:${r.productId}`, {
      canReview: true,
      isAdmin: data.isAdmin,
      myReview: r,
    })
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("kk-review-cache-primed"))
  }
}

export function clearUserReviewStateCache() {
  reviewStateCache.clear()
  reviewStateInFlight.clear()
  writePersistedSnapshot(null)
}

function getCachedReviewState(userId: string | undefined, productId: string): ReviewEligibilityState | null {
  if (!userId || productId.startsWith("ph-")) return null
  const key = `${userId}:${productId}`
  const direct = reviewStateCache.get(key)
  if (direct) return direct
  const snap = readPersistedSnapshot(userId)
  if (!snap) return null
  const myReview = snap.reviews[productId] ?? null
  const canReview = Boolean(myReview) || snap.deliveredProductIds.includes(productId)
  const resolved: ReviewEligibilityState = {
    canReview,
    isAdmin: snap.isAdmin,
    myReview,
  }
  reviewStateCache.set(key, resolved)
  return resolved
}

function fetchProductReviewStateCached(userId: string, productId: string): Promise<ReviewEligibilityState> {
  const key = `${userId}:${productId}`
  const cached = reviewStateCache.get(key)
  if (cached) return Promise.resolve(cached)
  const existing = reviewStateInFlight.get(key)
  if (existing) return existing
  const req = getMyProductReviewState(productId)
    .then((res) => {
      reviewStateCache.set(key, res)
      reviewStateInFlight.delete(key)
      const snap = readPersistedSnapshot(userId)
      if (snap) {
        const nextDelivered = new Set(snap.deliveredProductIds)
        if (res.canReview) nextDelivered.add(productId)
        const nextReviews = { ...snap.reviews }
        if (res.myReview) nextReviews[productId] = res.myReview
        else delete nextReviews[productId]
        writePersistedSnapshot({
          userId,
          isAdmin: res.isAdmin,
          deliveredProductIds: Array.from(nextDelivered),
          reviews: nextReviews,
        })
      }
      return res
    })
    .catch((err) => {
      reviewStateInFlight.delete(key)
      throw err
    })
  reviewStateInFlight.set(key, req)
  return req
}

function upsertPersistedProductReview(userId: string | undefined, review: ProductReview) {
  if (!userId) return
  const key = `${userId}:${review.productId}`
  const prev = reviewStateCache.get(key)
  const snap = readPersistedSnapshot(userId)
  const isAdmin = prev?.isAdmin ?? snap?.isAdmin ?? false
  const nextState: ReviewEligibilityState = {
    canReview: true,
    isAdmin,
    myReview: review,
  }
  reviewStateCache.set(key, nextState)
  const nextDelivered = new Set(snap?.deliveredProductIds ?? [])
  nextDelivered.add(review.productId)
  const nextReviews = { ...(snap?.reviews ?? {}), [review.productId]: review }
  writePersistedSnapshot({
    userId,
    isAdmin,
    deliveredProductIds: Array.from(nextDelivered),
    reviews: nextReviews,
  })
}

function invalidateProductReviewStateCache(productId?: string, removePersistedReview = false) {
  if (!productId) {
    reviewStateCache.clear()
    reviewStateInFlight.clear()
    return
  }
  const suffix = `:${productId}`
  for (const key of reviewStateCache.keys()) {
    if (key.endsWith(suffix)) reviewStateCache.delete(key)
  }
  for (const key of reviewStateInFlight.keys()) {
    if (key.endsWith(suffix)) reviewStateInFlight.delete(key)
  }
  if (removePersistedReview && memorySnapshot && memorySnapshot.reviews[productId]) {
    const nextReviews = { ...memorySnapshot.reviews }
    delete nextReviews[productId]
    writePersistedSnapshot({
      ...memorySnapshot,
      reviews: nextReviews,
    })
  }
}

function reviewTimestampMs(review: Pick<ProductReview, "createdAt" | "updatedAt">): number {
  const raw = review.updatedAt || review.createdAt
  const ms = new Date(raw).getTime()
  return Number.isFinite(ms) ? ms : 0
}

function formatReviewDateLabel(review: Pick<ProductReview, "createdAt" | "updatedAt">): string {
  const createdMs = new Date(review.createdAt).getTime()
  const updatedMs = review.updatedAt ? new Date(review.updatedAt).getTime() : createdMs
  if (Number.isFinite(createdMs) && Number.isFinite(updatedMs) && updatedMs - createdMs >= 500) {
    return `Edited · ${formatDate(review.updatedAt)}`
  }
  return formatDate(review.updatedAt || review.createdAt)
}

function mergeLiveReviews(
  serverReviews: readonly ProductReview[],
  liveMyReview: ProductReview | null,
  deletedIds?: ReadonlySet<string>
): ProductReview[] {
  const base = deletedIds && deletedIds.size > 0
    ? serverReviews.filter((r) => !deletedIds.has(r.id))
    : [...serverReviews]
  if (!liveMyReview || (deletedIds && deletedIds.has(liveMyReview.id))) {
    return base
  }
  const idx = base.findIndex(
    (r) => r.id === liveMyReview.id || (Boolean(liveMyReview.userId) && r.userId === liveMyReview.userId)
  )
  if (idx >= 0) {
    const existing = base[idx]
    const existingTime = reviewTimestampMs(existing)
    const liveTime = reviewTimestampMs(liveMyReview)
    if (!Number.isFinite(existingTime) || liveTime >= existingTime) {
      base[idx] = { ...existing, ...liveMyReview, createdAt: existing.createdAt || liveMyReview.createdAt }
    }
    return base
  }
  return [liveMyReview, ...base]
}

function parseLovedAspects(title: string | null | undefined, aspects: readonly string[]): Record<string, "up" | "down"> {
  void aspects
  if (!title) return {}
  const out: Record<string, "up" | "down"> = {}
  const segments = title.split("|").map((s) => s.trim())
  for (const seg of segments) {
    if (seg.startsWith(LOVED_PREFIX)) {
      for (const part of seg.slice(LOVED_PREFIX.length).split(",").map((s) => s.trim())) {
        if (part) out[part] = "up"
      }
    } else if (seg.startsWith(DISLIKED_PREFIX)) {
      for (const part of seg.slice(DISLIKED_PREFIX.length).split(",").map((s) => s.trim())) {
        if (part) out[part] = "down"
      }
    }
  }
  return out
}

function extractAspectPills(title?: string | null): { liked: string[]; disliked: string[] } {
  if (!title || (!title.startsWith(LOVED_PREFIX) && !title.startsWith(DISLIKED_PREFIX))) {
    return { liked: [], disliked: [] }
  }
  const liked: string[] = []
  const disliked: string[] = []
  for (const seg of title.split("|").map((s) => s.trim())) {
    if (seg.startsWith(LOVED_PREFIX)) {
      liked.push(
        ...seg
          .slice(LOVED_PREFIX.length)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      )
    } else if (seg.startsWith(DISLIKED_PREFIX)) {
      disliked.push(
        ...seg
          .slice(DISLIKED_PREFIX.length)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      )
    }
  }
  return { liked, disliked }
}

function formatLovedTitle(votes: Record<string, "up" | "down">, aspects: readonly string[], fallbackTitle?: string | null): string {
  const orderedAspects = [...aspects, ...Object.keys(votes).filter((k) => !aspects.includes(k))]
  const liked = orderedAspects.filter((aspect) => votes[aspect] === "up")
  const disliked = orderedAspects.filter((aspect) => votes[aspect] === "down")
  const build = () => {
    const parts: string[] = []
    if (liked.length > 0) parts.push(`${LOVED_PREFIX}${liked.join(", ")}`)
    if (disliked.length > 0) parts.push(`${DISLIKED_PREFIX}${disliked.join(", ")}`)
    return parts.join(" | ")
  }
  if (liked.length > 0 || disliked.length > 0) {
    let text = build()
    while (text.length > 400) {
      if (disliked.length > 0) disliked.pop()
      else if (liked.length > 0) liked.pop()
      else break
      text = build()
    }
    return text
  }
  if (fallbackTitle && !fallbackTitle.startsWith(LOVED_PREFIX) && !fallbackTitle.startsWith(DISLIKED_PREFIX)) {
    return fallbackTitle.slice(0, 400)
  }
  return ""
}

function StarRow({ rating, size = "sm" }: { rating: number; size?: "sm" | "md" }) {
  const iconClass = size === "md" ? styles.starMd : styles.starSm
  return (
    <span className={styles.starRow} aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <StarIcon
          key={star}
          className={cn(
            iconClass,
            star <= Math.round(rating)
              ? styles.starActive
              : styles.starEmpty
          )}
          aria-hidden
        />
      ))}
    </span>
  )
}

function InteractiveStarPicker({
  value,
  onSelect,
  size = "md",
  disabled = false,
}: {
  value: number
  onSelect: (star: number) => void
  size?: "sm" | "md" | "lg"
  disabled?: boolean
}) {
  const [hovered, setHovered] = useState<number | null>(null)
  const activeRating = hovered ?? value
  const starSize = size === "lg" ? styles.pickerSvgLg : size === "md" ? styles.pickerSvgMd : styles.pickerSvgSm

  return (
    <div

      className={styles.starPickerGrid}
      onMouseLeave={() => setHovered(null)}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const active = star <= activeRating
        const isCurrent = star === activeRating
        return (
          <button

            key={star}
            type="button"
            disabled={disabled}
            aria-label={`Rate ${star} out of 5 stars (${RATING_LABELS[star]})`}
            aria-pressed={value === star}
            onMouseEnter={() => setHovered(star)}
            onClick={() => onSelect(star)}
            className={cn(
              styles.starPickBtn,
              isCurrent && styles.starPickBtnCurrent
            )}
          >
            <StarIcon
              className={cn(
                starSize,
                active
                  ? styles.pickerSvgActive
                  : styles.pickerSvgIdle
              )}
            />
            <span

              className={cn(
                styles.pickerLabel,
                isCurrent
                  ? styles.pickerLabelCurrent
                  : active
                    ? styles.pickerLabelActive
                    : styles.pickerLabelIdle
              )}
            >
              {RATING_LABELS[star]}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function ShareExperienceDialog({
  open,
  onOpenChange,
  product,
  initialRating,
  existingReview,
  subtitle = "Verified purchase · Delivered",
  onSaved,
}: {
  open: boolean
  onOpenChange: (next: boolean) => void
  product: { id: string; name: string; image?: string | null; aspects?: readonly string[] }
  initialRating: number
  existingReview: ProductReview | null
  subtitle?: string
  onSaved: (savedReview: ProductReview) => void
}) {
  const router = useRouter()
  const { user } = useAuth()
  const [pending, startTransition] = useTransition()
  useBlockWhile(pending)
  const later = useToastAfter(pending)
  const aspects = product.aspects && product.aspects.length > 0 ? product.aspects : DEFAULT_REVIEW_ASPECTS
  const [aspectVotes, setAspectVotes] = useState<Record<string, "up" | "down">>(() =>
    parseLovedAspects(existingReview?.title, aspects)
  )

  const form = useForm<ProductReviewInput, unknown, ProductReviewValues>({
    resolver: zodResolver(productReviewSchema),
    defaultValues: {
      productId: product.id,
      rating: initialRating || existingReview?.rating || 5,
      title: existingReview?.title ?? "",
      comment: existingReview?.comment ?? "",
    },
  })
  const { errors } = form.formState
  const selectedRating = useWatch({ control: form.control, name: "rating" }) ?? 5

  useEffect(() => {
    if (!open) return
    const nextRating = initialRating || existingReview?.rating || 5
    form.reset({
      productId: product.id,
      rating: nextRating,
      title: existingReview?.title ?? "",
      comment: existingReview?.comment ?? "",
    })
    queueMicrotask(() => {
      setAspectVotes(parseLovedAspects(existingReview?.title, aspects))
    })
  }, [open, initialRating, existingReview, product.id, aspects, form])

  const toggleAspect = (aspect: string, vote: "up" | "down") => {
    setAspectVotes((prev) => {
      const next = { ...prev }
      if (next[aspect] === vote) {
        delete next[aspect]
      } else {
        next[aspect] = vote
      }
      return next
    })
  }

  const onSubmit = form.handleSubmit((values) => {
    const computedTitle = formatLovedTitle(aspectVotes, aspects, existingReview?.title)
    startTransition(async () => {
      const res = await submitProductReview({
        ...values,
        title: computedTitle,
      })
      if (!res.ok) {
        for (const [field, messages] of Object.entries(res.fieldErrors ?? {})) {
          if (messages?.[0] && (field === "rating" || field === "title" || field === "comment")) {
            form.setError(field, { message: messages[0] })
          }
        }
        toast.error(res.error)
        return
      }
      const nowMs = Date.now()
      const nowIso = new Date(nowMs).toISOString()
      const createdAtIso = existingReview?.createdAt ?? nowIso
      const createdMs = new Date(createdAtIso).getTime()
      const updatedAtIso = existingReview
        ? new Date(Math.max(nowMs, (Number.isFinite(createdMs) ? createdMs : nowMs) + 1000)).toISOString()
        : nowIso
      const savedReview: ProductReview = {
        id: res.data.id || existingReview?.id || `temp-${nowMs}`,
        productId: product.id,
        userId: existingReview?.userId || user?.id || "",
        reviewerName:
          existingReview?.reviewerName ||
          user?.name?.trim() ||
          user?.email?.split("@")[0] ||
          "Verified Buyer",
        rating: values.rating,
        title: computedTitle || null,
        comment: values.comment.trim(),
        isVerifiedPurchase: true,
        createdAt: createdAtIso,
        updatedAt: updatedAtIso,
      }
      upsertPersistedProductReview(user?.id, savedReview)
      later(() => {
        onOpenChange(false)
        onSaved(savedReview)
        toast.success(existingReview ? "Your review has been updated!" : "Thank you for sharing your experience!")
      })
      router.refresh()
    })
  })

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent mobileFullScreen className={styles.dialogModalLg}>
        <DialogHeader>
          <div className={styles.dialogTitleRow}>
            <DialogTitle className={styles.dialogTitleText}>Share your experience</DialogTitle>
            <span

              className={styles.twoMinBadge}
            >
              Only takes 2 min
            </span>
          </div>
          <DialogDescription className={styles.srOnly}>
            Rate {product.name} and share details of what you loved about this product.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate className={styles.reviewDialogForm}>
          <DialogBody className={styles.reviewDialogBody}>
            {/* Product context strip */}
            <div className={styles.productContextStrip}>
              {product.image !== undefined && (
                <div className={styles.contextThumb}>
                  <ProductImage src={product.image ?? null} alt={product.name} sizes="48px" />
                </div>
              )}
              <div className={styles.contextInfoCol}>
                <p className={styles.contextTitle}>
                  {product.name}
                </p>
                <p className={styles.contextSub}>
                  {subtitle}
                </p>
              </div>
            </div>

            {/* 5 labeled interactive stars */}
            <div className={styles.starPickerBox}>
              <InteractiveStarPicker
                size="lg"
                value={selectedRating}
                onSelect={(star) => form.setValue("rating", star, { shouldValidate: true, shouldDirty: true })}
              />
              {errors.rating?.message && (
                <p className={styles.ratingErrorMsg}>
                  {errors.rating.message}
                </p>
              )}
            </div>

            {/* What did you love about it? */}
            <div className={styles.aspectsSection}>
              <p className={styles.aspectsHeading}>
                What did you love about it?
              </p>
              <ul className={styles.aspectsList}>
                {aspects.map((aspect) => {
                  const vote = aspectVotes[aspect]
                  return (
                    <li

                      key={aspect}
                      className={styles.aspectRow}
                    >
                      <span className={styles.aspectLabel}>
                        {aspect}
                      </span>
                      <div className={styles.voteBtnsGroup}>
                        <button

                          type="button"
                          aria-label={`Liked ${aspect}`}
                          aria-pressed={vote === "up"}
                          onClick={() => toggleAspect(aspect, "up")}
                          className={cn(
                            styles.voteCircleBtn,
                            vote === "up" && styles.voteUpActive
                          )}
                        >
                          <ThumbsUpIcon className={styles.thumbSvg} />
                        </button>
                        <button

                          type="button"
                          aria-label={`Disliked ${aspect}`}
                          aria-pressed={vote === "down"}
                          onClick={() => toggleAspect(aspect, "down")}
                          className={cn(
                            styles.voteCircleBtn,
                            vote === "down" && styles.voteDownActive
                          )}
                        >
                          <ThumbsDownIcon className={styles.thumbSvg} />
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>

            {/* Tell us more */}
            <TextAreaField
              label="Tell us more"
              rows={4}
              maxLength={800}
              placeholder="Share details of what you loved about this product"
              error={errors.comment?.message}
              {...form.register("comment")}
            />
          </DialogBody>

          <DialogFooter className={styles.dialogColFooter}>
            <Button

              type="submit"
              size="lg"
              disabled={pending}
              className={styles.submitReviewBtn}
            >
              {pending && <Loader2Icon className={styles.spinSvg} />}
              {existingReview ? "Update review" : "Submit"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Interactive "Rate your experience -> Rate a product -> 5 stars" widget for delivered order items.
 * Selecting a star opens the Share your experience popup directly and saves the product review.
 */
export function OrderItemReviewWidget({
  item,
}: {
  item: { productId: string; slug: string; name: string; image: string | null; reviewAspects?: string[] }
}) {
  const router = useRouter()
  const { user, ready: authReady } = useAuth()
  const cachedInitial = getCachedReviewState(user?.id, item.productId)
  const [myReview, setMyReview] = useState<ProductReview | null>(() => cachedInitial?.myReview ?? null)
  const [loadedKey, setLoadedKey] = useState<string | null>(() =>
    user && cachedInitial ? `${user.id}:${item.productId}` : null
  )
  const [dialogOpen, setDialogOpen] = useState(false)
  const [draftRating, setDraftRating] = useState(() => cachedInitial?.myReview?.rating ?? 0)

  useEffect(() => {
    if (!authReady) return
    if (!user) {
      queueMicrotask(() => {
        setMyReview(null)
        setDraftRating(0)
        setLoadedKey(null)
        setDialogOpen(false)
      })
      return
    }
    const key = `${user.id}:${item.productId}`
    if (loadedKey === key) return
    let cancelled = false
    fetchProductReviewStateCached(user.id, item.productId)
      .then((res) => {
        if (cancelled) return
        setMyReview(res.myReview)
        setDraftRating(res.myReview?.rating ?? 0)
        setLoadedKey(key)
      })
      .catch(() => {
        // ignore
      })
    return () => {
      cancelled = true
    }
  }, [authReady, user, item.productId, loadedKey])

  useEffect(() => {
    const onReviewSync = (e: Event) => {
      const detail = (e as CustomEvent<{ productId?: string; review?: ProductReview | null }>).detail
      const pid = detail?.productId
      if (!pid || pid === item.productId) {
        if (detail && "review" in detail) {
          setMyReview(detail.review ?? null)
          setDraftRating(detail.review?.rating ?? 0)
          if (user) setLoadedKey(`${user.id}:${item.productId}`)
          return
        }
        invalidateProductReviewStateCache(item.productId)
        setLoadedKey(null)
      }
    }
    window.addEventListener("kk-review-updated", onReviewSync)
    return () => window.removeEventListener("kk-review-updated", onReviewSync)
  }, [item.productId, user])

  const handleStarSelect = (star: number) => {
    if (!user) {
      router.push(`/login?next=${encodeURIComponent(`/products/${item.slug}`)}`)
      return
    }
    setDraftRating(star)
    setDialogOpen(true)
  }

  return (
    <div className={styles.orderReviewWidget}>
      {myReview ? (
        <div className={styles.orderReviewedRow}>
          <div className={styles.orderReviewedMeta}>
            <span className={styles.orderReviewedLabel}>Your rating</span>
            <StarRow rating={myReview.rating} size="sm" />
            <span className={styles.ratingWordBadge}>
              {RATING_LABELS[myReview.rating] ?? "Great"}
            </span>
          </div>
          <div className={styles.orderReviewedActions}>
            <button
              type="button"
              onClick={() => handleStarSelect(myReview.rating)}
              className={styles.editMyReviewLink}
            >
              <PencilIcon className={styles.icon12} aria-hidden /> Edit
            </button>
            <Link
              href={`/products/${item.slug}/reviews`}
              className={styles.viewReviewsLink}
            >
              All reviews →
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className={styles.widgetHeaderRow}>
            <div>
              <p className={styles.widgetKicker}>
                Rate your experience
              </p>
              <p className={styles.widgetTitle}>
                Tap a star to rate this product
              </p>
            </div>
          </div>

          <div className={styles.widgetPickerWrap}>
            <InteractiveStarPicker
              size="sm"
              value={draftRating}
              onSelect={handleStarSelect}
            />
          </div>
        </>
      )}

      <ShareExperienceDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        product={{ id: item.productId, name: item.name, image: item.image, aspects: item.reviewAspects }}
        initialRating={draftRating || myReview?.rating || 5}
        existingReview={myReview}
        onSaved={(savedReview) => {
          setMyReview(savedReview)
          setDraftRating(savedReview.rating)
          if (user) setLoadedKey(`${user.id}:${item.productId}`)
          window.dispatchEvent(
            new CustomEvent("kk-review-updated", { detail: { productId: item.productId, review: savedReview } })
          )
        }}
      />
    </div>
  )
}

type AspectSummaryStat = {
  aspect: string
  likedCount: number
  dislikedCount: number
  totalVotes: number
  positivePct: number
}

function computeAspectStats(reviews: readonly ProductReview[], configuredAspects: readonly string[]): AspectSummaryStat[] {
  const counts = new Map<string, { liked: number; disliked: number }>()
  for (const a of configuredAspects) {
    counts.set(a, { liked: 0, disliked: 0 })
  }
  for (const r of reviews) {
    const pills = extractAspectPills(r.title)
    for (const liked of pills.liked) {
      const prev = counts.get(liked) ?? { liked: 0, disliked: 0 }
      counts.set(liked, { liked: prev.liked + 1, disliked: prev.disliked })
    }
    for (const disliked of pills.disliked) {
      const prev = counts.get(disliked) ?? { liked: 0, disliked: 0 }
      counts.set(disliked, { liked: prev.liked, disliked: prev.disliked + 1 })
    }
  }
  const list: AspectSummaryStat[] = []
  for (const [aspect, { liked, disliked }] of counts.entries()) {
    const totalVotes = liked + disliked
    const positivePct = totalVotes > 0 ? Math.round((liked / totalVotes) * 100) : 100
    list.push({ aspect, likedCount: liked, dislikedCount: disliked, totalVotes, positivePct })
  }
  return list.sort((a, b) => b.likedCount - a.likedCount || b.totalVotes - a.totalVotes)
}

function computeReviewSummary(
  product: Pick<Product, "ratingAvg" | "reviewCount">,
  reviews: readonly ProductReview[]
) {
  const totalCount = reviews.length > 0 ? reviews.length : (product.reviewCount ?? 0)
  const avgRating =
    reviews.length > 0
      ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10
      : Number(product.ratingAvg ?? 0)

  const distribution = [5, 4, 3, 2, 1].map((stars) => {
    const count = reviews.filter((r) => r.rating === stars).length
    const pct = reviews.length > 0 ? Math.round((count / reviews.length) * 100) : 0
    return { stars, count, pct }
  })

  return { totalCount, avgRating, distribution }
}

/**
 * Product Detail Page (PDP) compact Customer Ratings & Aspect Summary Card.
 * Shows only the read-only rating breakdown, what buyers loved, a "Write/Edit review" trigger for verified
 * buyers, and a prominent "See all customer reviews" CTA leading to `/products/[slug]/reviews`.
 */
export function ProductReviewsSection({
  product,
  initialReviews = [],
}: {
  product: Pick<Product, "id" | "slug" | "name" | "ratingAvg" | "reviewCount"> & {
    images?: string[]
    reviewAspects?: readonly string[] | null
    category?: { reviewAspects?: readonly string[] | null } | null
  }
  initialReviews?: ProductReview[]
}) {
  const { user, ready: authReady } = useAuth()
  const cachedInitial = getCachedReviewState(user?.id, product.id)
  const seededMyReview = cachedInitial?.myReview ?? null
  const [dialogOpen, setDialogOpen] = useState(false)
  const [draftRating, setDraftRating] = useState(() => cachedInitial?.myReview?.rating ?? seededMyReview?.rating ?? 0)
  const [canReview, setCanReview] = useState(() => cachedInitial?.canReview ?? false)
  const [myReview, setMyReview] = useState<ProductReview | null>(() => cachedInitial?.myReview ?? null)
  const [stateLoadedForUser, setStateLoadedForUser] = useState<string | null>(() =>
    user && cachedInitial ? `${user.id}:${product.id}` : null
  )
  const activeMyReview = myReview ?? seededMyReview

  useEffect(() => {
    if (product.id.startsWith("ph-")) return
    const scrollToReviews = (behavior: ScrollBehavior) => {
      if (window.location.hash !== "#customer-reviews") return
      const candidates = document.querySelectorAll<HTMLElement>("#customer-reviews")
      for (const node of candidates) {
        if (node.getClientRects().length > 0 && !node.closest("[data-skeleton]")) {
          node.scrollIntoView({ behavior, block: "start" })
          return
        }
      }
    }
    const rafId = window.requestAnimationFrame(() => scrollToReviews("instant"))
    const onHashChange = () => scrollToReviews("smooth")
    window.addEventListener("hashchange", onHashChange)
    return () => {
      window.cancelAnimationFrame(rafId)
      window.removeEventListener("hashchange", onHashChange)
    }
  }, [product.id])

  useEffect(() => {
    const onReviewSync = (e: Event) => {
      const detail = (e as CustomEvent<{ productId?: string; review?: ProductReview | null }>).detail
      const pid = detail?.productId
      if (!pid || pid === product.id) {
        if (detail && "review" in detail) {
          setMyReview(detail.review ?? null)
          setDraftRating(detail.review?.rating ?? 0)
          if (user) setStateLoadedForUser(`${user.id}:${product.id}`)
          return
        }
        invalidateProductReviewStateCache(product.id)
        setStateLoadedForUser(null)
      }
    }
    const onCachePrimed = () => {
      if (!user) return
      const primed = getCachedReviewState(user.id, product.id)
      if (primed) {
        setCanReview(primed.canReview)
        setMyReview(primed.myReview)
        setDraftRating(primed.myReview?.rating ?? 0)
        setStateLoadedForUser(`${user.id}:${product.id}`)
      }
    }
    window.addEventListener("kk-review-updated", onReviewSync)
    window.addEventListener("kk-review-cache-primed", onCachePrimed)
    return () => {
      window.removeEventListener("kk-review-updated", onReviewSync)
      window.removeEventListener("kk-review-cache-primed", onCachePrimed)
    }
  }, [product.id, user])

  useEffect(() => {
    if (!authReady || product.id.startsWith("ph-")) return
    if (!user) {
      queueMicrotask(() => {
        setCanReview(false)
        setMyReview(null)
        setDraftRating(0)
        setStateLoadedForUser(null)
        setDialogOpen(false)
      })
      return
    }
    const key = `${user.id}:${product.id}`
    if (stateLoadedForUser === key) return
    const cached = getCachedReviewState(user.id, product.id)
    if (cached) {
      queueMicrotask(() => {
        setCanReview(cached.canReview)
        setMyReview(cached.myReview)
        setDraftRating(cached.myReview?.rating ?? 0)
        setStateLoadedForUser(key)
      })
    }
    let cancelled = false
    getMyProductReviewState(product.id)
      .then((res) => {
        if (cancelled) return
        reviewStateCache.set(key, res)
        setCanReview(res.canReview)
        setMyReview(res.myReview)
        setDraftRating(res.myReview?.rating ?? 0)
        setStateLoadedForUser(key)
      })
      .catch(() => {
        // non-fatal
      })
    return () => {
      cancelled = true
    }
  }, [authReady, user, product.id, stateLoadedForUser])

  const openReviewModal = (star?: number) => {
    const chosen = star ?? activeMyReview?.rating ?? (draftRating || 5)
    setDraftRating(chosen)
    setDialogOpen(true)
  }

  const showBuyerReviewActions = Boolean(user && (canReview || activeMyReview))
  const liveReviews = mergeLiveReviews(initialReviews, activeMyReview)

  const { totalCount, avgRating, distribution } = computeReviewSummary(product, liveReviews)
  if (totalCount === 0 && !showBuyerReviewActions) return null

  const configuredAspects = resolveReviewAspects(product)
  const aspectStats = computeAspectStats(liveReviews, configuredAspects)
  const highlightedAspects = aspectStats.filter((a) => a.likedCount > 0)
  const displayAspects = highlightedAspects.length > 0 ? highlightedAspects : aspectStats.slice(0, 5)
  const allReviewsHref = `/products/${encodeURIComponent(product.slug)}/reviews`
  const topReviews = liveReviews
    .slice()
    .sort((a, b) => {
      if (b.rating !== a.rating) return b.rating - a.rating
      const aHasAspects = Number(Boolean(a.title && a.title.startsWith(LOVED_PREFIX)))
      const bHasAspects = Number(Boolean(b.title && b.title.startsWith(LOVED_PREFIX)))
      if (bHasAspects !== aHasAspects) return bHasAspects - aHasAspects
      if (b.comment.length !== a.comment.length) return b.comment.length - a.comment.length
      return reviewTimestampMs(b) - reviewTimestampMs(a)
    })
    .slice(0, 6)

  return (
    <section
      id="customer-reviews"
      className={cn("container-page", styles.reviewsSection)}
      aria-labelledby="reviews-heading"
    >
      <div className={styles.pdpRatingsCard}>
        {/* Left Column: Overall Rating + Read-only 5★–1★ Distribution Bars + Primary "See all reviews" CTA */}
        <div className={styles.pdpSummaryCol}>
          <div className={styles.pdpSummaryTop}>
            <div className={styles.pdpSummaryHeaderRow}>
              <h2 id="reviews-heading" className={styles.sectionHeading}>
                Customer ratings
              </h2>
              <span className={styles.verifiedBadgePill}>
                <CheckCircle2Icon className={styles.checkTinySvg} aria-hidden /> Verified
              </span>
            </div>

            <div className={styles.scoreAndBarsGrid}>
              <div className={styles.scoreHeroBox}>
                <span className={styles.avgNumber}>
                  {totalCount > 0 ? formatRating(avgRating) : "0.0"}
                </span>
                <div className={styles.starsAndCountCol}>
                  <StarRow rating={totalCount > 0 ? avgRating : 0} size="sm" />
                  <p className={styles.verifiedCountText}>
                    {totalCount > 0
                      ? `Based on ${totalCount} verified ${totalCount === 1 ? "review" : "reviews"}`
                      : "No verified reviews yet — be the first!"}
                  </p>
                </div>
              </div>

              <div className={styles.distributionList} aria-label="Rating breakdown">
                {distribution.map((row) => (
                  <div
                    key={row.stars}
                    className={cn(styles.distRowStatic, row.count === 0 && styles.distRowMuted)}
                  >
                    <span className={styles.distStarLabel}>{row.stars}★</span>
                    <div className={styles.distBarTrack}>
                      <div className={styles.distBarFill} style={{ width: `${row.pct}%` }} />
                    </div>
                    <span className={styles.distCountNum}>{row.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {(totalCount > 0 || showBuyerReviewActions) && (
            <div className={styles.pdpSummaryFooter}>
              <div className={styles.pdpReviewsFooterRow}>
                {totalCount > 0 && (
                  <Link
                    href={allReviewsHref}
                    className={cn(buttonVariants({ size: "lg" }), styles.seeAllPageBtn)}
                  >
                    <span>See all {totalCount} {totalCount === 1 ? "review" : "reviews"}</span>
                    <ArrowRightIcon className={styles.icon16} aria-hidden />
                  </Link>
                )}

                {showBuyerReviewActions && (
                  activeMyReview ? (
                    <div className={styles.myReviewSubmittedBar}>
                      <div className={styles.myReviewSummaryLeft}>
                        <StarRow rating={activeMyReview.rating} size="sm" />
                        <span className={styles.myReviewSummaryText}>
                          You rated {formatRating(activeMyReview.rating)}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => openReviewModal(activeMyReview.rating)}
                        className={styles.editMyReviewLink}
                      >
                        <PencilIcon className={styles.icon12} aria-hidden /> Edit review
                      </button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      size="lg"
                      variant="outline"
                      onClick={() => openReviewModal()}
                      className={styles.writeReviewOutlineBtn}
                    >
                      <MessageSquarePlusIcon className={styles.icon16} /> Write a review
                    </Button>
                  )
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Aspect Highlights + Top Customer Reviews Carousel */}
        <div className={styles.pdpHighlightsCol}>
          <div className={styles.pdpAspectsBlock}>
            <div className={styles.pdpAspectsHeader}>
              <h3 className={styles.topReviewsHeading}>What customers loved</h3>
              <span className={styles.verifiedGuaranteePill}>
                <CheckCircle2Icon className={styles.checkTinySvg} aria-hidden /> 100% Verified
              </span>
            </div>

            <div className={styles.pdpAspectsPillsGrid}>
              {displayAspects.map((stat) => (
                <div key={stat.aspect} className={styles.pdpAspectChip}>
                  <ThumbsUpIcon className={styles.pdpAspectThumbSvg} aria-hidden />
                  <span className={styles.pdpAspectName}>{stat.aspect}</span>
                  <span className={styles.pdpAspectStatBadge}>
                    {stat.likedCount > 0
                      ? `${stat.positivePct}% (${stat.likedCount})`
                      : "Verified"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {topReviews.length > 0 && (
            <div className={styles.topReviewsBlock}>
              <div className={styles.topReviewsHeader}>
                <h4 className={styles.topReviewsHeading}>Top customer reviews</h4>
                <Link href={allReviewsHref} className={styles.topReviewsAllLink}>
                  <span>Read all ({totalCount})</span>
                  <ArrowRightIcon className={styles.icon12} aria-hidden />
                </Link>
              </div>

              <Carousel label="Top customer reviews" className={styles.topReviewsCarousel}>
                {topReviews.map((review) => {
                  const aspectPills = extractAspectPills(review.title)
                  const initial = (review.reviewerName.trim()[0] ?? "V").toUpperCase()
                  return (
                    <li
                      key={review.id}
                      className={cn(
                        styles.topReviewSlide,
                        topReviews.length === 1 && styles.topReviewSlideSingle
                      )}
                    >
                      <article className={styles.topReviewCard}>
                        <div className={styles.topReviewTopRow}>
                          <div className={styles.topReviewStarsGroup}>
                            <StarRow rating={review.rating} />
                            <span className={styles.ratingWordBadge}>
                              {RATING_LABELS[review.rating] ?? "Great"}
                            </span>
                          </div>
                          <span className={styles.topReviewDate}>{formatReviewDateLabel(review)}</span>
                        </div>

                        {aspectPills.liked.length > 0 && (
                          <div className={styles.topReviewPillsRow}>
                            {aspectPills.liked.slice(0, 3).map((pill) => (
                              <span key={pill} className={styles.likedAspectPill}>
                                <ThumbsUpIcon className={styles.tinyThumbSvg} aria-hidden /> {pill}
                              </span>
                            ))}
                          </div>
                        )}

                        <p className={styles.topReviewQuote}>{review.comment}</p>

                        <div className={styles.topReviewAuthorRow}>
                          <span className={styles.reviewerAvatarCircle} aria-hidden>
                            {initial}
                          </span>
                          <div className={styles.reviewerAuthorMeta}>
                            <span className={styles.reviewerName}>{review.reviewerName}</span>
                            {review.isVerifiedPurchase && (
                              <span className={styles.verifiedMiniText}>
                                <CheckCircle2Icon className={styles.checkTinySvg} aria-hidden /> Verified buyer
                              </span>
                            )}
                          </div>
                        </div>
                      </article>
                    </li>
                  )
                })}
              </Carousel>
            </div>
          )}
        </div>
      </div>

      <ShareExperienceDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        product={{
          id: product.id,
          name: product.name,
          image: product.images?.[0] ?? null,
          aspects: configuredAspects,
        }}
        initialRating={draftRating || activeMyReview?.rating || 5}
        existingReview={activeMyReview}
        onSaved={(savedReview) => {
          setMyReview(savedReview)
          setDraftRating(savedReview.rating)
          if (user) setStateLoadedForUser(`${user.id}:${product.id}`)
          window.dispatchEvent(
            new CustomEvent("kk-review-updated", { detail: { productId: product.id, review: savedReview } })
          )
        }}
      />
    </section>
  )
}

const REVIEWS_PER_PAGE = 8

const REVIEW_SORT_OPTIONS = [
  { value: "recent", label: "Newest first" },
  { value: "highest", label: "Highest rated" },
  { value: "lowest", label: "Lowest rated" },
] as const

type ReviewSortKey = (typeof REVIEW_SORT_OPTIONS)[number]["value"]

/**
 * Dedicated full-page Customer Reviews view (`/products/[slug]/reviews`).
 * Features a top navigation bar with Breadcrumbs + "Back to product" pill, a clean Product Context
 * header card with quick Add to Cart, a sticky left sidebar with rating breakdown + interactive star
 * filters, and a right feed with keyword search, Sort SelectField, aspect tag chips, and automatic
 * IntersectionObserver infinite scroll as the user reaches the end of the list.
 */
export function ProductReviewsPageView({
  product,
  reviews,
}: {
  product: Product
  reviews: ProductReview[]
}) {
  const router = useRouter()
  const { user, ready: authReady } = useAuth()
  const add = useCart((s) => s.add)
  const inCart = useCart((s) => s.items.find((i) => i.productId === product.id)?.quantity ?? 0)

  const cachedInitial = getCachedReviewState(user?.id, product.id)
  const seededMyReview = cachedInitial?.myReview ?? null
  const [dialogOpen, setDialogOpen] = useState(false)
  const [draftRating, setDraftRating] = useState(() => cachedInitial?.myReview?.rating ?? seededMyReview?.rating ?? 0)
  const [deleteTarget, setDeleteTarget] = useState<ProductReview | null>(null)
  const [deletedIds, setDeletedIds] = useState<Set<string>>(() => new Set())
  const [canReview, setCanReview] = useState(() => cachedInitial?.canReview ?? false)
  const [isAdmin, setIsAdmin] = useState(() => cachedInitial?.isAdmin ?? false)
  const [myReview, setMyReview] = useState<ProductReview | null>(() => cachedInitial?.myReview ?? null)
  const [stateLoadedForUser, setStateLoadedForUser] = useState<string | null>(() =>
    user && cachedInitial ? `${user.id}:${product.id}` : null
  )
  const [pending, startTransition] = useTransition()
  useBlockWhile(pending)
  const later = useToastAfter(pending)
  const activeMyReview = myReview ?? seededMyReview

  const [reviewSort, setReviewSort] = useState<ReviewSortKey>("recent")
  const [starFilter, setStarFilter] = useState<number | null>(null)
  const [aspectFilter, setAspectFilter] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [visibleCount, setVisibleCount] = useState(REVIEWS_PER_PAGE)
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const onReviewSync = (e: Event) => {
      const detail = (e as CustomEvent<{ productId?: string; review?: ProductReview | null }>).detail
      const pid = detail?.productId
      if (!pid || pid === product.id) {
        if (detail && "review" in detail) {
          setMyReview(detail.review ?? null)
          setDraftRating(detail.review?.rating ?? 0)
          if (detail.review) {
            setDeletedIds((prev) => {
              if (!prev.has(detail.review!.id)) return prev
              const next = new Set(prev)
              next.delete(detail.review!.id)
              return next
            })
          }
          if (user) setStateLoadedForUser(`${user.id}:${product.id}`)
          return
        }
        invalidateProductReviewStateCache(product.id)
        setStateLoadedForUser(null)
      }
    }
    const onCachePrimed = () => {
      if (!user) return
      const primed = getCachedReviewState(user.id, product.id)
      if (primed) {
        setCanReview(primed.canReview)
        setIsAdmin(primed.isAdmin)
        setMyReview(primed.myReview)
        setDraftRating(primed.myReview?.rating ?? 0)
        setStateLoadedForUser(`${user.id}:${product.id}`)
      }
    }
    window.addEventListener("kk-review-updated", onReviewSync)
    window.addEventListener("kk-review-cache-primed", onCachePrimed)
    return () => {
      window.removeEventListener("kk-review-updated", onReviewSync)
      window.removeEventListener("kk-review-cache-primed", onCachePrimed)
    }
  }, [product.id, user])

  useEffect(() => {
    if (!authReady || product.id.startsWith("ph-")) return
    if (!user) {
      queueMicrotask(() => {
        setCanReview(false)
        setIsAdmin(false)
        setMyReview(null)
        setDraftRating(0)
        setStateLoadedForUser(null)
        setDialogOpen(false)
        setDeleteTarget(null)
      })
      return
    }
    const key = `${user.id}:${product.id}`
    if (stateLoadedForUser === key) return
    const cached = getCachedReviewState(user.id, product.id)
    if (cached) {
      queueMicrotask(() => {
        setCanReview(cached.canReview)
        setIsAdmin(cached.isAdmin)
        setMyReview(cached.myReview)
        setDraftRating(cached.myReview?.rating ?? 0)
        setStateLoadedForUser(key)
      })
    }
    let cancelled = false
    getMyProductReviewState(product.id)
      .then((res) => {
        if (cancelled) return
        reviewStateCache.set(key, res)
        setCanReview(res.canReview)
        setIsAdmin(res.isAdmin)
        setMyReview(res.myReview)
        setDraftRating(res.myReview?.rating ?? 0)
        setStateLoadedForUser(key)
      })
      .catch(() => {
        // non-fatal
      })
    return () => {
      cancelled = true
    }
  }, [authReady, user, product.id, stateLoadedForUser])

  const openReviewModal = (star?: number) => {
    const chosen = star ?? activeMyReview?.rating ?? (draftRating || 5)
    setDraftRating(chosen)
    setDialogOpen(true)
  }

  const showBuyerReviewActions = Boolean(user && (canReview || activeMyReview))

  const handleConfirmDelete = () => {
    if (!deleteTarget) return
    const target = deleteTarget
    startTransition(async () => {
      const res = await deleteProductReview({ reviewId: target.id, productId: product.id })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      later(() => {
        const isMineDeleted = Boolean(activeMyReview && target.id === activeMyReview.id)
        invalidateProductReviewStateCache(product.id, isMineDeleted)
        setDeletedIds((prev) => new Set(prev).add(target.id))
        if (isMineDeleted) {
          setMyReview(null)
          setDraftRating(0)
          if (user) {
            reviewStateCache.set(`${user.id}:${product.id}`, {
              canReview: true,
              isAdmin,
              myReview: null,
            })
            setStateLoadedForUser(`${user.id}:${product.id}`)
          }
        }
        setDeleteTarget(null)
        window.dispatchEvent(
          new CustomEvent("kk-review-updated", {
            detail: { productId: product.id, ...(isMineDeleted ? { review: null } : {}) },
          })
        )
        toast.success("Review removed.")
      })
      router.refresh()
    })
  }

  const quickAddToCart = () => {
    const max = Math.min(product.stock, MAX_QTY_PER_ITEM)
    if (product.stock <= 0) return
    const unit = max === 1 ? "item" : "items"
    if (inCart >= max) {
      toast.info(`You already have all ${max} available ${unit} in your cart.`)
      return
    }
    add(
      {
        productId: product.id,
        slug: product.slug,
        name: product.name,
        price: product.price,
        image: product.images[0] ?? null,
        maxQuantity: product.stock,
      },
      1
    )
  }

  const liveReviews = mergeLiveReviews(reviews, activeMyReview, deletedIds)
  const { totalCount, avgRating, distribution } = computeReviewSummary(product, liveReviews)
  const configuredAspects = resolveReviewAspects(product)
  const aspectStats = computeAspectStats(liveReviews, configuredAspects).filter((s) => s.totalVotes > 0)
  const off = discountPercent(product.price, product.compareAtPrice)

  const normalizedQuery = searchQuery.trim().toLowerCase()
  const filteredReviews = liveReviews
    .filter((r) => {
      if (starFilter !== null && r.rating !== starFilter) return false
      if (aspectFilter !== null) {
        const pills = extractAspectPills(r.title)
        if (!pills.liked.includes(aspectFilter) && !pills.disliked.includes(aspectFilter)) return false
      }
      if (normalizedQuery.length >= 2) {
        const haystack = `${r.reviewerName} ${r.title ?? ""} ${r.comment}`.toLowerCase()
        if (!haystack.includes(normalizedQuery)) return false
      }
      return true
    })
    .slice()
    .sort((a, b) => {
      if (reviewSort === "highest" && b.rating !== a.rating) return b.rating - a.rating
      if (reviewSort === "lowest" && a.rating !== b.rating) return a.rating - b.rating
      return reviewTimestampMs(b) - reviewTimestampMs(a)
    })

  const hasMore = filteredReviews.length > visibleCount
  const visibleReviews = filteredReviews.slice(0, visibleCount)
  const hasActiveFilters = starFilter !== null || aspectFilter !== null || normalizedQuery.length >= 2

  // Automatic infinite scroll when the user approaches the bottom of the currently rendered reviews
  useEffect(() => {
    if (!hasMore) return
    const node = loadMoreSentinelRef.current
    if (!node || typeof IntersectionObserver === "undefined") return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((prev) => Math.min(filteredReviews.length, prev + REVIEWS_PER_PAGE))
        }
      },
      { rootMargin: "280px 0px" }
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [hasMore, visibleCount, filteredReviews.length])

  const clearAllFilters = () => {
    setStarFilter(null)
    setAspectFilter(null)
    setSearchQuery("")
    setVisibleCount(REVIEWS_PER_PAGE)
  }

  const productHref = `/products/${encodeURIComponent(product.slug)}`
  const crumbs = [
    { name: "Home", href: "/" },
    ...(product.category ? [{ name: product.category.name, href: `/category/${product.category.slug}` }] : []),
    { name: product.name, href: productHref },
    { name: "Reviews" },
  ]

  return (
    <div className={cn("container-page", styles.reviewsPageWrap)}>
      {/* Top Navigation Bar: Breadcrumbs on Left + Back to Product Pill on Right */}
      <div className={styles.reviewsTopNavRow}>
        <Breadcrumbs items={crumbs} />
        <Link href={productHref} className={styles.backToProductPill}>
          <ArrowLeftIcon className={styles.icon14} aria-hidden /> Back to product
        </Link>
      </div>

      {/* Product Context Header Strip + Single Primary CTA */}
      <div className={styles.productBannerCard}>
        <div className={styles.bannerLeftGroup}>
          <Link href={productHref} className={styles.bannerThumbLink}>
            <ProductImage src={product.images[0] ?? null} alt={product.name} sizes="72px" />
          </Link>
          <div className={styles.bannerMetaCol}>
            {product.category && (
              <p className={styles.bannerCategoryEyebrow}>{product.category.name}</p>
            )}
            <h1 className={styles.bannerProductTitle}>
              <Link href={productHref}>{product.name}</Link>
            </h1>
            <div className={styles.bannerPriceRow}>
              <span className={styles.bannerPrice}>{formatPrice(product.price)}</span>
              {product.compareAtPrice && (
                <span className={styles.bannerComparePrice}>{formatPrice(product.compareAtPrice)}</span>
              )}
              {off && <span className={styles.bannerSavePill}>Save {off}%</span>}
              {totalCount > 0 && (
                <span className={styles.bannerRatingPill}>
                  <StarIcon className={styles.bannerStarIcon} aria-hidden />
                  <span>{formatRating(avgRating)}</span>
                  <span className={styles.bannerRatingCount}>({totalCount})</span>
                </span>
              )}
            </div>
          </div>
        </div>

        <div className={styles.bannerActionsGroup}>
          {product.stock > 0 ? (
            <Button type="button" size="lg" onClick={quickAddToCart} className={styles.bannerCartBtn}>
              <ShoppingBagIcon className={styles.icon16} aria-hidden /> Add to cart
            </Button>
          ) : (
            <Button type="button" size="lg" variant="outline" disabled className={styles.pillBtn}>
              Sold out
            </Button>
          )}
        </div>
      </div>

      <div className={styles.reviewsPageGrid}>
        {/* Left Sticky Sidebar: Rating Breakdown + Interactive Star Filter + Rate Widget */}
        <aside className={styles.reviewsSidebarCol}>
          <div className={styles.summaryLeftCard}>
            <div className={styles.summaryTopStack}>
              <div className={styles.pdpSummaryHeaderRow}>
                <h2 className={styles.sectionHeading}>Customer reviews</h2>
                <span className={styles.verifiedBadgePill}>
                  <CheckCircle2Icon className={styles.checkTinySvg} aria-hidden /> Verified
                </span>
              </div>

              <div className={styles.scoreAndBarsGrid}>
                <div className={styles.scoreHeroBox}>
                  <span className={styles.avgNumber}>
                    {totalCount > 0 ? formatRating(avgRating) : "0.0"}
                  </span>
                  <div className={styles.starsAndCountCol}>
                    <StarRow rating={totalCount > 0 ? avgRating : 0} size="sm" />
                    <p className={styles.verifiedCountText}>
                      {totalCount > 0
                        ? `Based on ${totalCount} verified ${totalCount === 1 ? "review" : "reviews"}`
                        : "No verified reviews yet"}
                    </p>
                  </div>
                </div>

                <div className={styles.distributionList} role="group" aria-label="Filter reviews by star rating">
                  {distribution.map((row) => {
                    const active = starFilter === row.stars
                    return (
                      <button
                        key={row.stars}
                        type="button"
                        disabled={row.count === 0}
                        aria-pressed={active}
                        onClick={() => {
                          setStarFilter((prev) => (prev === row.stars ? null : row.stars))
                          setVisibleCount(REVIEWS_PER_PAGE)
                        }}
                        className={cn(
                          styles.distRowBtn,
                          row.count > 0 ? styles.distRowInteractive : styles.distRowDisabled,
                          active && styles.distRowActive
                        )}
                      >
                        <span className={styles.distStarLabel}>{row.stars}★</span>
                        <div className={styles.distBarTrack}>
                          <div className={styles.distBarFill} style={{ width: `${row.pct}%` }} />
                        </div>
                        <span className={styles.distCountNum}>{row.count}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {showBuyerReviewActions && (
              <div className={styles.rateBottomBlock}>
                {activeMyReview ? (
                  <div className={styles.myReviewSubmittedBar}>
                    <div className={styles.myReviewSummaryLeft}>
                      <StarRow rating={activeMyReview.rating} size="sm" />
                      <span className={styles.myReviewSummaryText}>
                        You rated {formatRating(activeMyReview.rating)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => openReviewModal(activeMyReview.rating)}
                      className={styles.editMyReviewLink}
                    >
                      <PencilIcon className={styles.icon12} aria-hidden /> Edit review
                    </button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    size="lg"
                    variant="default"
                    onClick={() => openReviewModal()}
                    className={styles.fullPillBtn}
                  >
                    <MessageSquarePlusIcon className={styles.icon16} /> Write a customer review
                  </Button>
                )}
              </div>
            )}

            <div className={styles.genuineFooterBanner}>
              <span className={styles.genuineTextRow}>
                <CheckCircle2Icon className={styles.emeraldCheckSvg} aria-hidden />
                <span>Only customers with delivered orders can post a review.</span>
              </span>
            </div>
          </div>
        </aside>

        {/* Right Column: Search + Sort Dropdown, Topic Filter Chips & Infinite-Scrolling Reviews Feed */}
        <div className={styles.reviewsFeedCol}>
          {liveReviews.length === 0 ? (
            <div className={styles.emptyReviewsCard}>
              <StarRow rating={5} size="md" />
              <p className={styles.emptyTitle}>No reviews for {product.name} yet</p>
              <p className={styles.emptySub}>
                {canReview
                  ? "Click “Write a customer review” to share what you loved about this product."
                  : "Once customers receive their delivered order, their verified feedback will appear here."}
              </p>
            </div>
          ) : (
            <div className={styles.feedCardShell}>
              {/* Controls Toolbar: Row 1 = SearchField + Sort SelectField; Row 2 = Aspect/Star Filter Chips */}
              <div className={styles.feedToolbar}>
                <div className={styles.feedSearchRow}>
                  <SearchField
                    label="Search customer reviews"
                    pill
                    maxLength={LIMITS.search.max}
                    containerClassName={styles.feedSearchBox}
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value)
                      setVisibleCount(REVIEWS_PER_PAGE)
                    }}
                    onClear={() => {
                      setSearchQuery("")
                      setVisibleCount(REVIEWS_PER_PAGE)
                    }}
                    placeholder="Search reviews by keyword (e.g. finish, packaging, gift)…"
                  />

                  <SelectField
                    label="Sort reviews"
                    hideLabel
                    pill
                    prefix="Sort:"
                    containerClassName={styles.feedSortSelect}
                    value={reviewSort}
                    onValueChange={(next) => {
                      setReviewSort((next as ReviewSortKey) || "recent")
                      setVisibleCount(REVIEWS_PER_PAGE)
                    }}
                    options={REVIEW_SORT_OPTIONS}
                  />
                </div>

                {/* Aspect Filter Chips + Active Star Filter Chip */}
                {(aspectStats.length > 0 || starFilter !== null) && (
                  <div className={styles.aspectFilterRow} role="group" aria-label="Filter by product aspect">
                    <button
                      type="button"
                      aria-pressed={aspectFilter === null && starFilter === null}
                      onClick={() => {
                        setAspectFilter(null)
                        setStarFilter(null)
                        setVisibleCount(REVIEWS_PER_PAGE)
                      }}
                      className={cn(
                        styles.aspectFilterChip,
                        aspectFilter === null && starFilter === null && styles.aspectFilterChipActive
                      )}
                    >
                      <span>All reviews</span>
                      <span
                        className={cn(
                          styles.aspectChipCount,
                          aspectFilter === null && starFilter === null && styles.aspectChipCountActive
                        )}
                      >
                        {liveReviews.length}
                      </span>
                    </button>

                    {aspectStats.map((stat) => {
                      const active = aspectFilter === stat.aspect
                      return (
                        <button
                          key={stat.aspect}
                          type="button"
                          aria-pressed={active}
                          onClick={() => {
                            setAspectFilter((prev) => (prev === stat.aspect ? null : stat.aspect))
                            setVisibleCount(REVIEWS_PER_PAGE)
                          }}
                          className={cn(styles.aspectFilterChip, active && styles.aspectFilterChipActive)}
                        >
                          <span>{stat.aspect}</span>
                          <span className={cn(styles.aspectChipCount, active && styles.aspectChipCountActive)}>
                            {stat.totalVotes}
                          </span>
                        </button>
                      )
                    })}

                    {starFilter !== null && (
                      <button
                        type="button"
                        onClick={() => {
                          setStarFilter(null)
                          setVisibleCount(REVIEWS_PER_PAGE)
                        }}
                        className={styles.clearStarFilterBtn}
                      >
                        {starFilter}★ only ✕
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className={styles.showingCountBar}>
                <p className={styles.showingCountText}>
                  Showing <strong className={styles.strongFg}>{visibleReviews.length}</strong> of{" "}
                  <strong className={styles.strongFg}>{filteredReviews.length}</strong>{" "}
                  verified {filteredReviews.length === 1 ? "review" : "reviews"}
                </p>

                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className={styles.resetReviewsFilterBtn}
                  >
                    <RotateCcwIcon className={styles.icon12} aria-hidden /> Clear filters
                  </button>
                )}
              </div>

              {filteredReviews.length === 0 ? (
                <div className={styles.noStarFilterBox}>
                  <p className={styles.noFilterMsg}>
                    No reviews match your current filter or search criteria.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={styles.pillBtn}
                    onClick={clearAllFilters}
                  >
                    Clear all filters
                  </Button>
                </div>
              ) : (
                <>
                  <ul className={styles.fullReviewsList}>
                    {visibleReviews.map((review) => {
                      const isMine = Boolean(activeMyReview && review.id === activeMyReview.id)
                      const canDelete = isMine || isAdmin
                      const aspectPills = extractAspectPills(review.title)
                      const hasCustomTitle = Boolean(
                        review.title && aspectPills.liked.length === 0 && aspectPills.disliked.length === 0
                      )
                      return (
                        <li key={review.id} className={styles.reviewCardItem}>
                          <div className={styles.reviewCardTopRow}>
                            <div className={styles.reviewMetaCol}>
                              <div className={styles.reviewRatingTitleRow}>
                                <StarRow rating={review.rating} />
                                <span className={styles.ratingWordBadge}>
                                  {RATING_LABELS[review.rating] ?? "Great"}
                                </span>
                                {hasCustomTitle && (
                                  <span className={styles.customReviewTitle}>{review.title}</span>
                                )}
                              </div>
                              <div className={styles.reviewerBylineRow}>
                                <span className={styles.reviewerName}>{review.reviewerName}</span>
                                {review.isVerifiedPurchase && (
                                  <span className={styles.verifiedBadgePill}>
                                    <CheckCircle2Icon className={styles.checkTinySvg} aria-hidden /> Verified purchase
                                  </span>
                                )}
                                <span aria-hidden>·</span>
                                <span>{formatReviewDateLabel(review)}</span>
                              </div>
                            </div>

                            {(isMine || canDelete) && (
                              <div className={styles.reviewOwnerBtns}>
                                {isMine && (
                                  <button
                                    type="button"
                                    aria-label="Edit your review"
                                    onClick={() => openReviewModal(review.rating)}
                                    className={styles.ownerIconBtn}
                                  >
                                    <PencilIcon className={styles.icon14} />
                                  </button>
                                )}
                                {canDelete && (
                                  <button
                                    type="button"
                                    aria-label="Delete review"
                                    onClick={() => setDeleteTarget(review)}
                                    className={cn(styles.ownerIconBtn, styles.ownerDeleteBtn)}
                                  >
                                    <Trash2Icon className={styles.icon14} />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>

                          {(aspectPills.liked.length > 0 || aspectPills.disliked.length > 0) && (
                            <div className={styles.aspectPillsWrap}>
                              {aspectPills.liked.map((pill) => (
                                <span key={`up-${pill}`} className={styles.likedAspectPill}>
                                  <ThumbsUpIcon className={styles.tinyThumbSvg} aria-hidden /> {pill}
                                </span>
                              ))}
                              {aspectPills.disliked.map((pill) => (
                                <span key={`down-${pill}`} className={styles.dislikedAspectPill}>
                                  <ThumbsDownIcon className={styles.tinyThumbSvg} aria-hidden /> {pill}
                                </span>
                              ))}
                            </div>
                          )}

                          <p className={styles.fullCommentText}>{review.comment}</p>
                        </li>
                      )
                    })}
                  </ul>

                  {hasMore ? (
                    <div ref={loadMoreSentinelRef} className={styles.infiniteScrollSentinel}>
                      <span className={styles.infiniteScrollStatus}>
                        <Loader2Icon className={styles.spinSvg} aria-hidden />
                        <span>Loading more reviews ({filteredReviews.length - visibleCount} remaining)…</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setVisibleCount((prev) => Math.min(filteredReviews.length, prev + REVIEWS_PER_PAGE))}
                        className={styles.loadMoreFallbackBtn}
                      >
                        Load now
                      </button>
                    </div>
                  ) : (
                    filteredReviews.length > REVIEWS_PER_PAGE && (
                      <p className={styles.endOfFeedNote}>
                        You&apos;ve reached the end of all {filteredReviews.length} verified reviews.
                      </p>
                    )
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Share your experience Dialog */}
      <ShareExperienceDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        product={{
          id: product.id,
          name: product.name,
          image: product.images[0] ?? null,
          aspects: configuredAspects,
        }}
        initialRating={draftRating || activeMyReview?.rating || 5}
        existingReview={activeMyReview}
        onSaved={(savedReview) => {
          setMyReview(savedReview)
          setDraftRating(savedReview.rating)
          setDeletedIds((prev) => {
            if (!prev.has(savedReview.id)) return prev
            const next = new Set(prev)
            next.delete(savedReview.id)
            return next
          })
          if (user) setStateLoadedForUser(`${user.id}:${product.id}`)
          window.dispatchEvent(
            new CustomEvent("kk-review-updated", { detail: { productId: product.id, review: savedReview } })
          )
        }}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(next) => !next && setDeleteTarget(null)}
        title="Delete this review?"
        description={
          <>
            This will permanently remove the review by <strong className={styles.strongFg}>{deleteTarget?.reviewerName}</strong> and recalculate the product&apos;s rating.
          </>
        }
        confirmLabel="Delete review"
        cancelLabel="Cancel"
        destructive
        pending={pending}
        onConfirm={handleConfirmDelete}
      />
    </div>
  )
}
