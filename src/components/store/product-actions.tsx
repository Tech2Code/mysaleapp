"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowLeftIcon, ArrowRightIcon, CheckCircle2Icon, Loader2Icon, MessageSquarePlusIcon, PackageXIcon, PencilIcon, RotateCcwIcon, ShoppingBagIcon, StarIcon, ThumbsDownIcon, ThumbsUpIcon, Trash2Icon } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState, useTransition } from "react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { SearchField, SelectField, TextAreaField } from "@/components/form"
import { useBlockWhile } from "@/components/shared/busy-overlay"
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
import { deleteProductReview, getMyProductReviewState, submitProductReview } from "@/features/products/actions"
import { productReviewSchema, type ProductReviewInput, type ProductReviewValues } from "@/features/products/schema"
import type { Product, ProductReview } from "@/features/products/types"
import { discountPercent, formatDate, formatPrice } from "@/lib/format"
import { cn } from "@/lib/utils"
import { LIMITS } from "@/lib/validation"
import { useAuth } from "@/store/auth"
import { MAX_QTY_PER_ITEM, useCart } from "@/store/cart"
import { ProductImage } from "./product-image"
import { QuantityStepper } from "./quantity-stepper"
import { WishlistButton } from "./wishlist-button"
import styles from "./product-actions.module.css"

export function ProductActions({
  product,
}: {
  product: Pick<Product, "id" | "slug" | "name" | "price" | "images" | "stock">
}) {
  const router = useRouter()
  const add = useCart((s) => s.add)
  const setOpen = useCart((s) => s.setOpen)
  const inCart = useCart((s) => s.items.find((i) => i.productId === product.id)?.quantity ?? 0)
  const [chosen, setChosen] = useState(1)
  const soldOut = product.stock <= 0
  const max = Math.min(product.stock, MAX_QTY_PER_ITEM)
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

  const line = {
    productId: product.id,
    slug: product.slug,
    name: product.name,
    price: product.price,
    image: product.images[0] ?? null,
    maxQuantity: product.stock,
  }

  if (soldOut) {
    return (
      <div className={styles.actionsStack}>
        <p role="status" className={styles.soldOutBanner}>
          <PackageXIcon className={styles.pkgXSvg} />
          <span>
            Sold out for now — handmade pieces take time. Save it to your wishlist and check back soon.
          </span>
        </p>
        <div className={styles.soldOutRow}>
          <Button size="lg" variant="outline" disabled className={styles.soldOutBtn}>
            <ShoppingBagIcon className={styles.bagSvg20} /> Sold out
          </Button>
          <WishlistButton productId={product.id} productName={product.name} size="lg" className={styles.wishlistBtn52} />
        </div>
        <Button size="lg" disabled className={styles.soldOutBuyBtn}>
          Buy now
        </Button>
      </div>
    )
  }

  return (
    <div className={styles.actionsStack}>
      {product.stock <= 5 && (
        <p className={styles.lowStockAlert}>
          Only {product.stock} {product.stock === 1 ? "item" : "items"} left in stock
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
          <span className={styles.buyBtnPriceLg}>{formatPrice(product.price * qty)}</span>
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
          <span className={styles.buyBtnPriceSm}>{formatPrice(product.price * qty)}</span>
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
  "Craftsmanship",
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

const reviewStateCache = new Map<string, ReviewEligibilityState>()
const reviewStateInFlight = new Map<string, Promise<ReviewEligibilityState>>()

function getCachedReviewState(userId: string | undefined, productId: string): ReviewEligibilityState | null {
  if (!userId || productId.startsWith("ph-")) return null
  return reviewStateCache.get(`${userId}:${productId}`) ?? null
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
      return res
    })
    .catch((err) => {
      reviewStateInFlight.delete(key)
      throw err
    })
  reviewStateInFlight.set(key, req)
  return req
}

function invalidateProductReviewStateCache(productId?: string) {
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
}

function parseLovedAspects(title: string | null | undefined, aspects: readonly string[]): Record<string, "up" | "down"> {
  if (!title) return {}
  const out: Record<string, "up" | "down"> = {}
  const segments = title.split("|").map((s) => s.trim())
  for (const seg of segments) {
    if (seg.startsWith(LOVED_PREFIX)) {
      for (const part of seg.slice(LOVED_PREFIX.length).split(",").map((s) => s.trim())) {
        if (aspects.includes(part)) out[part] = "up"
      }
    } else if (seg.startsWith(DISLIKED_PREFIX)) {
      for (const part of seg.slice(DISLIKED_PREFIX.length).split(",").map((s) => s.trim())) {
        if (aspects.includes(part)) out[part] = "down"
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
  const liked = aspects.filter((aspect) => votes[aspect] === "up")
  const disliked = aspects.filter((aspect) => votes[aspect] === "down")
  const parts: string[] = []
  if (liked.length > 0) parts.push(`${LOVED_PREFIX}${liked.join(", ")}`)
  if (disliked.length > 0) parts.push(`${DISLIKED_PREFIX}${disliked.join(", ")}`)
  if (parts.length > 0) {
    return parts.join(" | ").slice(0, 100)
  }
  if (fallbackTitle && !fallbackTitle.startsWith(LOVED_PREFIX) && !fallbackTitle.startsWith(DISLIKED_PREFIX)) {
    return fallbackTitle.slice(0, 100)
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
  onSaved: (savedRating: number) => void
}) {
  const router = useRouter()
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
      later(() => {
        onOpenChange(false)
        onSaved(values.rating)
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
  item: { productId: string; slug: string; name: string; image: string | null }
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
      const pid = (e as CustomEvent<{ productId?: string }>).detail?.productId
      if (!pid || pid === item.productId) {
        invalidateProductReviewStateCache(item.productId)
        setLoadedKey(null)
      }
    }
    window.addEventListener("kk-review-updated", onReviewSync)
    return () => window.removeEventListener("kk-review-updated", onReviewSync)
  }, [item.productId])

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
      <div className={styles.widgetHeaderRow}>
        <div>
          <p className={styles.widgetKicker}>
            Rate your experience
          </p>
          <p className={styles.widgetTitle}>
            {myReview ? "Your product rating (tap a star to edit)" : "Rate a product"}
          </p>
        </div>
        {myReview && (
          <Link
            href={`/products/${item.slug}/reviews`}
            className={styles.viewReviewsLink}
          >
            View reviews →
          </Link>
        )}
      </div>

      <div className={styles.widgetPickerWrap}>
        <InteractiveStarPicker
          size="sm"
          value={myReview?.rating ?? draftRating}
          onSelect={handleStarSelect}
        />
      </div>

      <ShareExperienceDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        product={{ id: item.productId, name: item.name, image: item.image }}
        initialRating={draftRating || myReview?.rating || 5}
        existingReview={myReview}
        onSaved={(savedRating) => {
          invalidateProductReviewStateCache(item.productId)
          setDraftRating(savedRating)
          setLoadedKey(null)
          window.dispatchEvent(new CustomEvent("kk-review-updated", { detail: { productId: item.productId } }))
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
  const totalCount = Math.max(reviews.length, product.reviewCount ?? 0)
  const avgRating =
    product.reviewCount && product.reviewCount > reviews.length && product.ratingAvg
      ? Number(product.ratingAvg)
      : reviews.length > 0
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
  const router = useRouter()
  const { user, ready: authReady } = useAuth()
  const cachedInitial = getCachedReviewState(user?.id, product.id)
  const seededMyReview = user ? (initialReviews.find((r) => r.userId === user.id) ?? null) : null
  const [dialogOpen, setDialogOpen] = useState(false)
  const [draftRating, setDraftRating] = useState(() => cachedInitial?.myReview?.rating ?? seededMyReview?.rating ?? 0)
  const [canReview, setCanReview] = useState(() => cachedInitial?.canReview ?? false)
  const [myReview, setMyReview] = useState<ProductReview | null>(() => cachedInitial?.myReview ?? null)
  const [stateLoadedForUser, setStateLoadedForUser] = useState<string | null>(() =>
    user && cachedInitial ? `${user.id}:${product.id}` : null
  )
  const activeMyReview = myReview ?? seededMyReview
  const reviewStateReady = authReady && (!user || stateLoadedForUser === `${user.id}:${product.id}`)

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
      const pid = (e as CustomEvent<{ productId?: string }>).detail?.productId
      if (!pid || pid === product.id) {
        invalidateProductReviewStateCache(product.id)
        setStateLoadedForUser(null)
      }
    }
    window.addEventListener("kk-review-updated", onReviewSync)
    return () => window.removeEventListener("kk-review-updated", onReviewSync)
  }, [product.id])

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
    let cancelled = false
    fetchProductReviewStateCached(user.id, product.id)
      .then((res) => {
        if (cancelled) return
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

  const openReviewModal = (star?: number, resolvedMyReview?: ProductReview | null) => {
    const targetReview = resolvedMyReview !== undefined ? resolvedMyReview : activeMyReview
    const chosen = star ?? targetReview?.rating ?? (draftRating || 5)
    setDraftRating(chosen)
    setDialogOpen(true)
  }

  const handleReviewTrigger = async (star?: number) => {
    if (product.id.startsWith("ph-")) return
    if (!user) {
      toast.info("Please sign in to rate and review this product.")
      router.push(`/login?next=${encodeURIComponent(`/products/${product.slug}#customer-reviews`)}`)
      return
    }
    if (canReview || activeMyReview) {
      openReviewModal(star)
      return
    }
    if (!reviewStateReady) {
      try {
        const res = await fetchProductReviewStateCached(user.id, product.id)
        setCanReview(res.canReview)
        setMyReview(res.myReview)
        setDraftRating(res.myReview?.rating ?? 0)
        setStateLoadedForUser(`${user.id}:${product.id}`)
        if (res.canReview || res.myReview) {
          openReviewModal(star, res.myReview)
          return
        }
      } catch {
        // fall through to message
      }
    }
    toast.info("Only customers who have received a delivered order for this item can submit a verified review.")
  }

  const { totalCount, avgRating, distribution } = computeReviewSummary(product, initialReviews)
  if (totalCount === 0 && !canReview && !activeMyReview) return null

  const configuredAspects = resolveReviewAspects(product)
  const aspectStats = computeAspectStats(initialReviews, configuredAspects)
  const highlightedAspects = aspectStats.filter((a) => a.likedCount > 0)
  const displayAspects = highlightedAspects.length > 0 ? highlightedAspects : aspectStats.slice(0, 5)

  return (
    <section
      id="customer-reviews"
      className={cn("container-page", styles.reviewsSection)}
      aria-labelledby="reviews-heading"
    >
      <div className={styles.pdpRatingsCard}>
        {/* Left Column: Overall Rating + Read-only 5★–1★ Distribution Bars */}
        <div className={styles.pdpSummaryCol}>
          <div className={styles.pdpSummaryHeader}>
            <p className={styles.kickerAccent}>Verified buyers</p>
            <h2 id="reviews-heading" className={styles.sectionHeading}>
              Customer ratings
            </h2>
          </div>

          <div className={styles.scoreAndBarsGrid}>
            <div className={styles.scoreBigBox}>
              <span className={styles.avgNumber}>
                {totalCount > 0 ? avgRating.toFixed(1) : "0.0"}
              </span>
              <div className={styles.starsAndCountCol}>
                <StarRow rating={totalCount > 0 ? avgRating : 0} size="md" />
                <p className={styles.verifiedCountText}>
                  {totalCount > 0
                    ? `Based on ${totalCount} verified ${totalCount === 1 ? "review" : "reviews"}`
                    : "No verified reviews yet — be the first!"}
                </p>
              </div>
            </div>

            <div className={styles.distributionList} aria-label="Rating breakdown">
              {distribution.map((row) => (
                <div key={row.stars} className={styles.distRowStatic}>
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

        {/* Right Column: Aspect Highlights + Rate Widget + "See all X reviews" CTA */}
        <div className={styles.pdpHighlightsCol}>
          <div className={styles.pdpAspectsBlock}>
            <div className={styles.pdpAspectsHeader}>
              <div>
                <h3 className={styles.feedbackTitle}>What customers loved</h3>
                <p className={styles.feedbackSub}>
                  Highlights from verified delivered orders of {product.name}
                </p>
              </div>
              <span className={styles.verifiedGuaranteePill}>
                <CheckCircle2Icon className={styles.checkTinySvg} aria-hidden /> 100% Verified
              </span>
            </div>

            <div className={styles.pdpAspectsPillsGrid}>
              {displayAspects.map((stat) => (
                <div key={stat.aspect} className={styles.pdpAspectCard}>
                  <span className={styles.pdpAspectIcon}>
                    <ThumbsUpIcon className={styles.tinyThumbSvg} aria-hidden />
                  </span>
                  <div className={styles.pdpAspectText}>
                    <p className={styles.pdpAspectName}>{stat.aspect}</p>
                    <p className={styles.pdpAspectMeta}>
                      {stat.likedCount > 0
                        ? `${stat.positivePct}% positive (${stat.likedCount})`
                        : "Verified quality"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.pdpBuyerRateStrip}>
            <div className={styles.pdpBuyerRateText}>
              <p className={styles.rateKicker}>Rate your experience</p>
              <p className={styles.rateSub}>
                {activeMyReview ? "Tap a star to update your review" : "Share your feedback on this piece"}
              </p>
            </div>
            <div className={styles.pdpBuyerPickerWrap}>
              <InteractiveStarPicker
                size="sm"
                value={activeMyReview?.rating ?? draftRating}
                onSelect={(star) => void handleReviewTrigger(star)}
              />
            </div>
          </div>

          <div className={styles.pdpReviewsFooterRow}>
            {totalCount > 0 && (
              <Link
                href={`/products/${encodeURIComponent(product.slug)}/reviews`}
                className={cn(buttonVariants({ size: "lg" }), styles.seeAllPageBtn)}
              >
                <span>See all {totalCount} {totalCount === 1 ? "review" : "reviews"}</span>
                <ArrowRightIcon className={styles.icon16} aria-hidden />
              </Link>
            )}

            <Button
              type="button"
              size="lg"
              variant="outline"
              onClick={() => void handleReviewTrigger()}
              className={styles.writeReviewOutlineBtn}
            >
              {activeMyReview ? (
                <>
                  <PencilIcon className={styles.icon16} /> Edit your review
                </>
              ) : (
                <>
                  <MessageSquarePlusIcon className={styles.icon16} /> Write a review
                </>
              )}
            </Button>
          </div>
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
        onSaved={(savedRating) => {
          invalidateProductReviewStateCache(product.id)
          setDraftRating(savedRating)
          setStateLoadedForUser(null)
          window.dispatchEvent(new CustomEvent("kk-review-updated", { detail: { productId: product.id } }))
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
  const seededMyReview = user ? (reviews.find((r) => r.userId === user.id) ?? null) : null
  const [dialogOpen, setDialogOpen] = useState(false)
  const [draftRating, setDraftRating] = useState(() => cachedInitial?.myReview?.rating ?? seededMyReview?.rating ?? 0)
  const [deleteTarget, setDeleteTarget] = useState<ProductReview | null>(null)
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
  const reviewStateReady = authReady && (!user || stateLoadedForUser === `${user.id}:${product.id}`)

  const [reviewSort, setReviewSort] = useState<ReviewSortKey>("recent")
  const [starFilter, setStarFilter] = useState<number | null>(null)
  const [aspectFilter, setAspectFilter] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [visibleCount, setVisibleCount] = useState(REVIEWS_PER_PAGE)
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const onReviewSync = (e: Event) => {
      const pid = (e as CustomEvent<{ productId?: string }>).detail?.productId
      if (!pid || pid === product.id) {
        invalidateProductReviewStateCache(product.id)
        setStateLoadedForUser(null)
      }
    }
    window.addEventListener("kk-review-updated", onReviewSync)
    return () => window.removeEventListener("kk-review-updated", onReviewSync)
  }, [product.id])

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
    let cancelled = false
    fetchProductReviewStateCached(user.id, product.id)
      .then((res) => {
        if (cancelled) return
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

  const openReviewModal = (star?: number, resolvedMyReview?: ProductReview | null) => {
    const targetReview = resolvedMyReview !== undefined ? resolvedMyReview : activeMyReview
    const chosen = star ?? targetReview?.rating ?? (draftRating || 5)
    setDraftRating(chosen)
    setDialogOpen(true)
  }

  const handleReviewTrigger = async (star?: number) => {
    if (product.id.startsWith("ph-")) return
    if (!user) {
      toast.info("Please sign in to rate and review this product.")
      router.push(`/login?next=${encodeURIComponent(`/products/${product.slug}/reviews`)}`)
      return
    }
    if (canReview || activeMyReview) {
      openReviewModal(star)
      return
    }
    if (!reviewStateReady) {
      try {
        const res = await fetchProductReviewStateCached(user.id, product.id)
        setCanReview(res.canReview)
        setIsAdmin(res.isAdmin)
        setMyReview(res.myReview)
        setDraftRating(res.myReview?.rating ?? 0)
        setStateLoadedForUser(`${user.id}:${product.id}`)
        if (res.canReview || res.myReview) {
          openReviewModal(star, res.myReview)
          return
        }
      } catch {
        // fall through to message
      }
    }
    toast.info("Only customers who have received a delivered order for this item can submit a verified review.")
  }

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
        invalidateProductReviewStateCache(product.id)
        if (user && target.userId === user.id) {
          setMyReview(null)
          setDraftRating(0)
        }
        setDeleteTarget(null)
        setStateLoadedForUser(null)
        window.dispatchEvent(new CustomEvent("kk-review-updated", { detail: { productId: product.id } }))
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

  const { totalCount, avgRating, distribution } = computeReviewSummary(product, reviews)
  const configuredAspects = resolveReviewAspects(product)
  const aspectStats = computeAspectStats(reviews, configuredAspects).filter((s) => s.totalVotes > 0)
  const off = discountPercent(product.price, product.compareAtPrice)

  const normalizedQuery = searchQuery.trim().toLowerCase()
  const filteredReviews = reviews
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
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
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
                  <span>{avgRating.toFixed(1)}</span>
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
              <div>
                <p className={styles.kickerAccent}>Verified buyers</p>
                <h2 className={styles.sectionHeading}>Customer reviews</h2>
              </div>

              <div className={styles.scoreAndBarsGrid}>
                <div className={styles.scoreBigBox}>
                  <span className={styles.avgNumber}>
                    {totalCount > 0 ? avgRating.toFixed(1) : "0.0"}
                  </span>
                  <div className={styles.starsAndCountCol}>
                    <StarRow rating={totalCount > 0 ? avgRating : 0} size="sm" />
                    <p className={styles.verifiedCountText}>
                      {totalCount > 0
                        ? `${totalCount} verified ${totalCount === 1 ? "review" : "reviews"}`
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

            <div className={styles.rateBottomBlock}>
              <div className={styles.rateWidgetBox}>
                <p className={styles.rateKicker}>Rate your experience</p>
                <p className={styles.rateSub}>
                  {activeMyReview ? "Your rating — tap any star to edit your review" : "Rate this purchased piece"}
                </p>
                <div className={styles.ratePickerMargin}>
                  <InteractiveStarPicker
                    size="md"
                    value={activeMyReview?.rating ?? draftRating}
                    onSelect={(star) => void handleReviewTrigger(star)}
                  />
                </div>
              </div>

              <Button
                type="button"
                variant={activeMyReview ? "outline" : "default"}
                onClick={() => void handleReviewTrigger()}
                className={styles.fullPillBtn}
              >
                {activeMyReview ? (
                  <>
                    <PencilIcon className={styles.icon16} /> Edit your review
                  </>
                ) : (
                  <>
                    <MessageSquarePlusIcon className={styles.icon16} /> Write a customer review
                  </>
                )}
              </Button>
            </div>

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
          {reviews.length === 0 ? (
            <div className={styles.emptyReviewsCard}>
              <StarRow rating={5} size="md" />
              <p className={styles.emptyTitle}>No reviews for {product.name} yet</p>
              <p className={styles.emptySub}>
                {canReview
                  ? "Select a star under “Rate your experience” to share what you loved about this handmade piece."
                  : "Once customers receive their delivered order, their verified feedback will appear here."}
              </p>
              <Link
                href={productHref}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), styles.pillBtn)}
              >
                <ArrowLeftIcon className={styles.icon14} aria-hidden /> Back to product
              </Link>
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
                        {reviews.length}
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
                      const isMine = Boolean(user && review.userId === user.id)
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
                                <span>{formatDate(review.createdAt)}</span>
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
        onSaved={(savedRating) => {
          invalidateProductReviewStateCache(product.id)
          setDraftRating(savedRating)
          setStateLoadedForUser(null)
          window.dispatchEvent(new CustomEvent("kk-review-updated", { detail: { productId: product.id } }))
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
