"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { CheckCircle2Icon, Loader2Icon, MessageSquarePlusIcon, PackageXIcon, PencilIcon, ShoppingBagIcon, StarIcon, ThumbsDownIcon, ThumbsUpIcon, Trash2Icon } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState, useTransition } from "react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { TextAreaField } from "@/components/form"
import { useBlockWhile } from "@/components/shared/busy-overlay"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
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
import { formatDate, formatPrice } from "@/lib/format"
import { cn } from "@/lib/utils"
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
  const [myReview, setMyReview] = useState<ProductReview | null>(null)
  const [loadedKey, setLoadedKey] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [draftRating, setDraftRating] = useState(0)

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
    getMyProductReviewState(item.productId)
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
      if (!pid || pid === item.productId) setLoadedKey(null)
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

            href={`/products/${item.slug}#customer-reviews`}
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
          setDraftRating(savedRating)
          setLoadedKey(null)
          window.dispatchEvent(new CustomEvent("kk-review-updated", { detail: { productId: item.productId } }))
        }}
      />
    </div>
  )
}

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
  const [dialogOpen, setDialogOpen] = useState(false)
  const [draftRating, setDraftRating] = useState(0)
  const [deleteTarget, setDeleteTarget] = useState<ProductReview | null>(null)
  const [canReview, setCanReview] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [myReview, setMyReview] = useState<ProductReview | null>(null)
  const [stateLoadedForUser, setStateLoadedForUser] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  useBlockWhile(pending)
  const later = useToastAfter(pending)
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

  const [allReviewsOpen, setAllReviewsOpen] = useState(false)
  const [reviewSort, setReviewSort] = useState<"recent" | "highest" | "lowest">("recent")
  const [starFilter, setStarFilter] = useState<number | null>(null)
  const reviewsListRef = useRef<HTMLUListElement>(null)
  const totalCount = Math.max(initialReviews.length, product.reviewCount ?? 0)

  useEffect(() => {
    const el = reviewsListRef.current
    if (!el) return
    el.scrollTo({ left: 0, top: 0, behavior: "instant" })
  }, [reviewSort, starFilter])

  useEffect(() => {
    const onReviewSync = (e: Event) => {
      const pid = (e as CustomEvent<{ productId?: string }>).detail?.productId
      if (!pid || pid === product.id) setStateLoadedForUser(null)
    }
    window.addEventListener("kk-review-updated", onReviewSync)
    return () => window.removeEventListener("kk-review-updated", onReviewSync)
  }, [product.id])

  useEffect(() => {
    if (!authReady) return
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
    getMyProductReviewState(product.id)
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

  const openReviewModal = (star?: number) => {
    const chosen = star ?? myReview?.rating ?? (draftRating || 5)
    setDraftRating(chosen)
    setDialogOpen(true)
  }

  const handleStarClick = (star: number) => {
    if (!authReady || !reviewStateReady) return
    if (!user) {
      router.push(`/login?next=${encodeURIComponent(`/products/${product.slug}#customer-reviews`)}`)
      return
    }
    if (!canReview && !myReview) {
      toast.info("Only customers who have received a delivered order for this item can submit a verified review.")
      return
    }
    openReviewModal(star)
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

  if (totalCount === 0) return null

  const avgRating =
    product.reviewCount && product.reviewCount > initialReviews.length && product.ratingAvg
      ? Number(product.ratingAvg)
      : initialReviews.length > 0
        ? Math.round((initialReviews.reduce((s, r) => s + r.rating, 0) / initialReviews.length) * 10) / 10
        : Number(product.ratingAvg ?? 0)

  const distribution = [5, 4, 3, 2, 1].map((stars) => {
    const count = initialReviews.filter((r) => r.rating === stars).length
    const pct = initialReviews.length > 0 ? Math.round((count / initialReviews.length) * 100) : 0
    return { stars, count, pct }
  })

  const displayedReviews = initialReviews
    .filter((r) => starFilter === null || r.rating === starFilter)
    .slice()
    .sort((a, b) => {
      if (reviewSort === "highest" && b.rating !== a.rating) return b.rating - a.rating
      if (reviewSort === "lowest" && a.rating !== b.rating) return a.rating - b.rating
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })

  return (
    <section

      id="customer-reviews"
      className={cn("container-page", styles.reviewsSection)}
      aria-labelledby="reviews-heading"
    >
      <div className={styles.reviewsOuterGrid}>
        {/* Left summary + Rate your experience column (equal height with right column) */}
        <div className={styles.summaryLeftCard}>
          <div className={styles.summaryTopStack}>
            <div>
              <p className={styles.kickerAccent}>
                Verified buyers
              </p>
              <h2 id="reviews-heading" className={styles.sectionHeading}>
                Customer reviews
              </h2>
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
                      : "No verified reviews yet — be the first!"}
                  </p>
                </div>
              </div>

              <div className={styles.distributionList}>
                {distribution.map((row) => {
                  const active = starFilter === row.stars
                  return (
                    <button

                      key={row.stars}
                      type="button"
                      disabled={row.count === 0}
                      aria-pressed={active}
                      onClick={() => setStarFilter((prev) => (prev === row.stars ? null : row.stars))}
                      className={cn(
                        styles.distRowBtn,
                        row.count > 0 ? styles.distRowInteractive : styles.distRowDisabled,
                        active && styles.distRowActive
                      )}
                    >
                      <span className={styles.distStarLabel}>
                        {row.stars}★
                      </span>
                      <div className={styles.distBarTrack}>
                        <div

                          className={styles.distBarFill}
                          style={{ width: `${row.pct}%` }}
                        />
                      </div>
                      <span className={styles.distCountNum}>
                        {row.count}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Rate your experience -> Rate a product -> 5 interactive stars */}
          <div className={styles.rateBottomBlock}>
            <div className={styles.rateWidgetBox}>
              <p className={styles.rateKicker}>
                Rate your experience
              </p>
              <p className={styles.rateSub}>
                {myReview ? "Your rating — tap any star to edit your review" : "Rate a product"}
              </p>
              <div className={styles.ratePickerMargin}>
                <InteractiveStarPicker
                  size="md"
                  disabled={!reviewStateReady}
                  value={myReview?.rating ?? draftRating}
                  onSelect={handleStarClick}
                />
              </div>
            </div>

            {!reviewStateReady ? null : !user ? (
              <Link

                href={`/login?next=${encodeURIComponent(`/products/${product.slug}#customer-reviews`)}`}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), styles.fullPillBtn)}
              >
                Sign in to write a review
              </Link>
            ) : canReview || myReview ? (
              <Button

                type="button"
                variant={myReview ? "outline" : "default"}
                onClick={() => openReviewModal()}
                className={styles.fullPillBtn}
              >
                {myReview ? (
                  <>
                    <PencilIcon className={styles.icon16} /> Edit your review
                  </>
                ) : (
                  <>
                    <MessageSquarePlusIcon className={styles.icon16} /> Write a customer review
                  </>
                )}
              </Button>
            ) : null}
          </div>
        </div>

        {/* Right reviews list column (equal height card with left column) */}
        <div className={styles.reviewsRightCard}>
          {initialReviews.length === 0 ? (
            <div className={styles.emptyReviewsCard}>
              <StarRow rating={5} size="md" />
              <p className={styles.emptyTitle}>
                Be the first to review {product.name}
              </p>
              <p className={styles.emptySub}>
                Select a star under &ldquo;Rate your experience&rdquo; to share what you loved about this handmade piece.
              </p>
            </div>
          ) : (
            <>
              <div className={styles.reviewsContentFlex}>
                <div className={styles.desktopListHeader}>
                  <div>
                    <h3 className={styles.feedbackTitle}>
                      Verified customer feedback
                    </h3>
                    <p className={styles.feedbackSub}>
                      Real experiences shared by customers after delivery
                    </p>
                  </div>
                  <span className={styles.totalCountBadge}>
                    {totalCount} {totalCount === 1 ? "review" : "reviews"}
                  </span>
                </div>

                {initialReviews.length > 1 && (
                  <div className={cn("no-scrollbar", styles.sortPillsRow)}>
                    {(
                      [
                        { id: "recent", label: "Newest" },
                        { id: "highest", label: "Highest" },
                        { id: "lowest", label: "Lowest" },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        aria-pressed={reviewSort === opt.id}
                        onClick={() => setReviewSort(opt.id)}
                        className={cn(
                          styles.sortChipBtn,
                          reviewSort === opt.id && styles.sortChipBtnActive
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                    {starFilter !== null && (
                      <button
                        type="button"
                        onClick={() => setStarFilter(null)}
                        className={styles.clearStarFilterBtn}
                      >
                        {starFilter}★ only ✕
                      </button>
                    )}
                  </div>
                )}

                {displayedReviews.length === 0 ? (
                  <div className={styles.noStarFilterBox}>
                    <p className={styles.noFilterMsg}>No {starFilter}★ reviews yet.</p>
                    <Button type="button" variant="outline" size="sm" className={styles.pillBtn} onClick={() => setStarFilter(null)}>
                      Show all reviews
                    </Button>
                  </div>
                ) : (
                <ul
                  ref={reviewsListRef}

                  data-slot="reviews-list"
                  className={cn("no-scrollbar", styles.reviewsCarouselUl)}
                >
                  {displayedReviews.map((review) => {
                    const isMine = Boolean(user && review.userId === user.id)
                    const canDelete = isMine || isAdmin
                    const aspectPills = extractAspectPills(review.title)
                    const hasCustomTitle = Boolean(review.title && aspectPills.liked.length === 0 && aspectPills.disliked.length === 0)
                    return (
                      <li

                        key={review.id}
                        className={styles.reviewCardItem}
                      >
                        <div className={styles.reviewCardTopRow}>
                          <div className={styles.reviewMetaCol}>
                            <div className={styles.reviewRatingTitleRow}>
                              <StarRow rating={review.rating} />
                              <span className={styles.ratingWordBadge}>
                                {RATING_LABELS[review.rating] ?? "Great"}
                              </span>
                              {hasCustomTitle && (
                                <span className={styles.customReviewTitle}>
                                  {review.title}
                                </span>
                              )}
                            </div>
                            <div className={styles.reviewerBylineRow}>
                              <span className={styles.reviewerName}>
                                {review.reviewerName}
                              </span>
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
                              <span

                                key={`up-${pill}`}
                                className={styles.likedAspectPill}
                              >
                                <ThumbsUpIcon className={styles.tinyThumbSvg} aria-hidden /> {pill}
                              </span>
                            ))}
                            {aspectPills.disliked.map((pill) => (
                              <span

                                key={`down-${pill}`}
                                className={styles.dislikedAspectPill}
                              >
                                <ThumbsDownIcon className={styles.tinyThumbSvg} aria-hidden /> {pill}
                              </span>
                            ))}
                          </div>
                        )}

                        <p className={styles.reviewCommentText}>
                          {review.comment}
                        </p>
                      </li>
                    )
                  })}
                </ul>
                )}
                {initialReviews.length > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setAllReviewsOpen(true)}
                    className={styles.seeAllMobileBtn}
                  >
                    See all {initialReviews.length} reviews
                  </Button>
                )}
              </div>

              <div className={styles.genuineFooterBanner}>
                <span className={styles.genuineTextRow}>
                  <CheckCircle2Icon className={styles.emeraldCheckSvg} aria-hidden />
                  <span>100% genuine reviews from verified delivered orders</span>
                </span>
                {(canReview || myReview) && (
                  <button

                    type="button"
                    onClick={() => openReviewModal()}
                    className={styles.addUpdateLinkBtn}
                  >
                    {myReview ? "Update your review →" : "Add your review →"}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* All Reviews Mobile Sheet / Dialog */}
      <Dialog open={allReviewsOpen} onOpenChange={setAllReviewsOpen}>
        <DialogContent mobileFullScreen className={styles.dialogModalLg}>
          <DialogHeader>
            <DialogTitle>Customer reviews ({totalCount})</DialogTitle>
            <DialogDescription>
              Verified buyer feedback for {product.name}
            </DialogDescription>
          </DialogHeader>
          <DialogBody className={styles.allReviewsModalBody}>
            {initialReviews.length > 1 && (
              <div className={cn("no-scrollbar", styles.stickyModalSortBar, styles.sortPillsRow)}>
                {(
                  [
                    { id: "recent", label: "Newest" },
                    { id: "highest", label: "Highest" },
                    { id: "lowest", label: "Lowest" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={`all-sort-${opt.id}`}
                    type="button"
                    aria-pressed={reviewSort === opt.id}
                    onClick={() => setReviewSort(opt.id)}
                    className={cn(
                      styles.sortChipBtn,
                      reviewSort === opt.id && styles.sortChipBtnActive
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
                {starFilter !== null && (
                  <button
                    type="button"
                    onClick={() => setStarFilter(null)}
                    className={styles.clearStarFilterBtn}
                  >
                    {starFilter}★ only ✕
                  </button>
                )}
              </div>
            )}
            {displayedReviews.map((review) => {
              const aspectPills = extractAspectPills(review.title)
              const hasCustomTitle = Boolean(review.title && aspectPills.liked.length === 0 && aspectPills.disliked.length === 0)
              return (
                <div key={`all-${review.id}`} className={styles.allReviewsItemCard}>
                  <div className={styles.reviewRatingTitleRow}>
                    <StarRow rating={review.rating} />
                    <span className={styles.ratingWordBadge}>
                      {RATING_LABELS[review.rating] ?? "Great"}
                    </span>
                    {hasCustomTitle && <span className={styles.customReviewTitle}>{review.title}</span>}
                  </div>
                  <div className={cn(styles.reviewerBylineRow, styles.bylineMargin)}>
                    <span className={styles.reviewerName}>{review.reviewerName}</span>
                    {review.isVerifiedPurchase && (
                      <span className={styles.verifiedBadgePill}>
                        <CheckCircle2Icon className={styles.checkTinySvg} aria-hidden /> Verified purchase
                      </span>
                    )}
                    <span aria-hidden>·</span>
                    <span>{formatDate(review.createdAt)}</span>
                  </div>
                  {(aspectPills.liked.length > 0 || aspectPills.disliked.length > 0) && (
                    <div className={styles.aspectPillsWrap}>
                      {aspectPills.liked.map((pill) => (
                        <span key={`all-up-${pill}`} className={styles.likedAspectPill}>
                          <ThumbsUpIcon className={styles.tinyThumbSvg} aria-hidden /> {pill}
                        </span>
                      ))}
                      {aspectPills.disliked.map((pill) => (
                        <span key={`all-down-${pill}`} className={styles.dislikedAspectPill}>
                          <ThumbsDownIcon className={styles.tinyThumbSvg} aria-hidden /> {pill}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className={styles.fullCommentText}>{review.comment}</p>
                </div>
              )
            })}
          </DialogBody>
        </DialogContent>
      </Dialog>

      {/* Share your experience Dialog */}
      <ShareExperienceDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        product={{
          id: product.id,
          name: product.name,
          image: product.images?.[0] ?? null,
          aspects: resolveReviewAspects(product),
        }}
        initialRating={draftRating || myReview?.rating || 5}
        existingReview={myReview}
        onSaved={(savedRating) => {
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
    </section>
  )
}
