"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { CheckCircle2Icon, Loader2Icon, MessageSquarePlusIcon, PackageXIcon, PencilIcon, ShoppingBagIcon, StarIcon, ThumbsDownIcon, ThumbsUpIcon, Trash2Icon } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState, useTransition } from "react"
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
      <div data-ui="store/ProductActions" className="space-y-3 sm:space-y-4">
        <p data-ui="store/ProductActions/p-flex" role="status" className="flex items-start gap-2 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm font-medium text-destructive">
          <PackageXIcon className="mt-0.5 size-4 shrink-0" />
          <span data-ui="store/ProductActions/span">
            Sold out for now — handmade pieces take time. Save it to your wishlist and check back soon.
          </span>
        </p>
        <div data-ui="store/ProductActions/div-flex" className="flex gap-3">
          <Button data-ui="store/ProductActions/Button-sold-out" size="lg" variant="outline" disabled className="h-13 flex-1 rounded-full text-base">
            <ShoppingBagIcon className="size-5" /> Sold out
          </Button>
          <WishlistButton productId={product.id} productName={product.name} size="lg" className="size-13" />
        </div>
        <Button data-ui="store/ProductActions/Button-buy-now" size="lg" disabled className="h-13 w-full rounded-full text-base">
          Buy now
        </Button>
      </div>
    )
  }

  return (
    <div data-ui="store/ProductActions" className="space-y-3 sm:space-y-4">
      {product.stock <= 5 && (
        <p data-ui="store/ProductActions/p" className="text-sm font-medium text-destructive">
          Only {product.stock} {product.stock === 1 ? "item" : "items"} left in stock
        </p>
      )}
      {/* Row 1: quantity | add to cart, 50 / 50. Row 2: buy now (the rest of the row) + wishlist. Every control is h-13. */}
      <div data-ui="store/ProductActions/div-grid" className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-2 sm:gap-3">
        <QuantityStepper label={product.name} value={qty} max={max} onChange={setChosen} size="lg" className="h-12 w-full justify-between sm:h-13" />
        <WishlistButton productId={product.id} productName={product.name} size="lg" className="size-12 shrink-0 sm:hidden" />
        <Button data-ui="store/ProductActions/Button-add-to-cart"
          size="lg"
          variant="outline"
          className="hidden h-13 min-w-0 rounded-full px-3 text-sm sm:inline-flex sm:text-base"
          onClick={addToCart}
        >
          <ShoppingBagIcon className="size-5" /> Add to cart
        </Button>
      </div>
      <div data-ui="store/ProductActions/div-hidden" className="hidden gap-2 sm:flex sm:gap-3">
        <Button data-ui="store/ProductActions/Button"
          size="lg"
          className="h-14 min-w-0 flex-1 flex-col gap-0.5 rounded-full bg-whatsapp-solid py-1.5 text-white shadow-lg shadow-whatsapp/25 tabular-nums hover:bg-whatsapp-solid/90"
          onClick={buyNow}
        >
          <span data-ui="store/ProductActions/span-2" className="text-sm/tight font-semibold">Buy now</span>
          <span data-ui="store/ProductActions/span-3" className="text-base/tight font-extrabold tracking-tight">{formatPrice(product.price * qty)}</span>
        </Button>
        <WishlistButton productId={product.id} productName={product.name} size="lg" className="size-14 shrink-0" />
      </div>

      {/* Native Android e-commerce sticky bottom buy bar on phones */}
      <div
        data-ui="store/ProductActions/div-grid-2"
        data-mobile-bottom-bar
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-2 items-center gap-2.5 border-t border-border/80 bg-background/95 px-3.5 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_28px_-8px_rgb(0_0_0/0.16)] backdrop-blur-xl sm:hidden in-data-skeleton:hidden"
      >
        <Button
          data-ui="store/ProductActions/Button-add-to-cart-2"
          size="lg"
          variant="outline"
          className="h-13 min-w-0 rounded-full px-3 text-sm font-semibold active:scale-97"
          onClick={addToCart}
        >
          <ShoppingBagIcon className="size-4.5" /> Add to cart
        </Button>
        <Button
          data-ui="store/ProductActions/Button-2"
          size="lg"
          className="h-13 min-w-0 flex-col gap-0.5 rounded-full bg-whatsapp-solid px-3 py-1.5 text-white shadow-md shadow-whatsapp/25 tabular-nums active:scale-97 hover:bg-whatsapp-solid/90"
          onClick={buyNow}
        >
          <span data-ui="store/ProductActions/span-4" className="text-sm/tight font-semibold">Buy now</span>
          <span data-ui="store/ProductActions/span-5" className="text-sm/tight font-extrabold tracking-tight">{formatPrice(product.price * qty)}</span>
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

const REVIEW_ASPECTS = [
  "Colour",
  "Comfort",
  "Material Quality",
  "Light Weight",
  "True to Specs",
] as const

const LOVED_PREFIX = "Loved: "
const DISLIKED_PREFIX = "Disliked: "

function parseLovedAspects(title?: string | null): Record<string, "up" | "down"> {
  if (!title) return {}
  const out: Record<string, "up" | "down"> = {}
  const segments = title.split("|").map((s) => s.trim())
  for (const seg of segments) {
    if (seg.startsWith(LOVED_PREFIX)) {
      for (const part of seg.slice(LOVED_PREFIX.length).split(",").map((s) => s.trim())) {
        if ((REVIEW_ASPECTS as readonly string[]).includes(part)) out[part] = "up"
      }
    } else if (seg.startsWith(DISLIKED_PREFIX)) {
      for (const part of seg.slice(DISLIKED_PREFIX.length).split(",").map((s) => s.trim())) {
        if ((REVIEW_ASPECTS as readonly string[]).includes(part)) out[part] = "down"
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

function formatLovedTitle(votes: Record<string, "up" | "down">, fallbackTitle?: string | null): string {
  const liked = REVIEW_ASPECTS.filter((aspect) => votes[aspect] === "up")
  const disliked = REVIEW_ASPECTS.filter((aspect) => votes[aspect] === "down")
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
  const iconClass = size === "md" ? "size-4.5" : "size-3.5"
  return (
    <span data-ui="store/StarRow" className="inline-flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <StarIcon
          key={star}
          className={cn(
            iconClass,
            star <= Math.round(rating)
              ? "fill-amber-400 text-amber-400"
              : "fill-muted text-muted-foreground/30"
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
  const starSize = size === "lg" ? "size-9 sm:size-10" : size === "md" ? "size-6 sm:size-7" : "size-5"

  return (
    <div
      data-ui="store/InteractiveStarPicker"
      className="grid grid-cols-5 gap-1 sm:gap-2"
      onMouseLeave={() => setHovered(null)}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const active = star <= activeRating
        const isCurrent = star === activeRating
        return (
          <button
            data-ui="store/InteractiveStarPicker/button"
            key={star}
            type="button"
            disabled={disabled}
            aria-label={`Rate ${star} out of 5 stars (${RATING_LABELS[star]})`}
            aria-pressed={value === star}
            onMouseEnter={() => setHovered(star)}
            onClick={() => onSelect(star)}
            className={cn(
              "group flex flex-col items-center justify-center gap-1 rounded-xl py-1.5 transition-transform active:scale-92 focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
              isCurrent && "scale-105"
            )}
          >
            <StarIcon
              className={cn(
                starSize,
                "transition-all duration-150",
                active
                  ? "fill-amber-400 text-amber-400 drop-shadow-[0_2px_6px_rgb(251_191_36/0.35)]"
                  : "fill-muted/70 text-muted-foreground/35 group-hover:text-amber-300"
              )}
            />
            <span
              data-ui="store/InteractiveStarPicker/span"
              className={cn(
                "text-[11px]/tight transition-colors",
                isCurrent
                  ? "font-bold text-foreground"
                  : active
                    ? "font-medium text-foreground/80"
                    : "font-medium text-muted-foreground"
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
  product: { id: string; name: string; image?: string | null }
  initialRating: number
  existingReview: ProductReview | null
  subtitle?: string
  onSaved: (savedRating: number) => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  useBlockWhile(pending)
  const later = useToastAfter(pending)
  const [aspectVotes, setAspectVotes] = useState<Record<string, "up" | "down">>(() =>
    parseLovedAspects(existingReview?.title)
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
      setAspectVotes(parseLovedAspects(existingReview?.title))
    })
  }, [open, initialRating, existingReview, product.id, form])

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
    const computedTitle = formatLovedTitle(aspectVotes, existingReview?.title)
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
      <DialogContent data-ui="store/ShareExperienceDialog/DialogContent" mobileFullScreen className="sm:max-w-lg">
        <DialogHeader>
          <div data-ui="store/ShareExperienceDialog/div-flex" className="flex flex-wrap items-center justify-between gap-2 sm:pr-8">
            <DialogTitle className="text-lg font-semibold">Share your experience</DialogTitle>
            <span
              data-ui="store/ShareExperienceDialog/span"
              className="rounded-md bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground"
            >
              Only takes 2 min
            </span>
          </div>
          <DialogDescription className="sr-only">
            Rate {product.name} and share details of what you loved about this product.
          </DialogDescription>
        </DialogHeader>

        <form data-ui="store/ShareExperienceDialog/form-flex" onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <DialogBody className="space-y-5">
            {/* Product context strip */}
            <div data-ui="store/ShareExperienceDialog/div-flex-2" className="flex items-center gap-3 rounded-2xl border bg-muted/35 p-3">
              {product.image !== undefined && (
                <div data-ui="store/ShareExperienceDialog/div-relative" className="relative size-12 shrink-0 overflow-hidden rounded-xl border bg-muted @container">
                  <ProductImage src={product.image ?? null} alt={product.name} sizes="48px" />
                </div>
              )}
              <div data-ui="store/ShareExperienceDialog/div" className="min-w-0 flex-1">
                <p data-ui="store/ShareExperienceDialog/p" className="line-clamp-1 text-sm font-semibold text-foreground">
                  {product.name}
                </p>
                <p data-ui="store/ShareExperienceDialog/p-2" className="mt-0.5 text-xs text-muted-foreground">
                  {subtitle}
                </p>
              </div>
            </div>

            {/* 5 labeled interactive stars */}
            <div data-ui="store/ShareExperienceDialog/div-2" className="rounded-2xl border bg-card px-3 py-3.5">
              <InteractiveStarPicker
                size="lg"
                value={selectedRating}
                onSelect={(star) => form.setValue("rating", star, { shouldValidate: true, shouldDirty: true })}
              />
              {errors.rating?.message && (
                <p data-ui="store/ShareExperienceDialog/p-3" className="mt-2 text-center text-xs font-medium text-destructive">
                  {errors.rating.message}
                </p>
              )}
            </div>

            {/* What did you love about it? */}
            <div data-ui="store/ShareExperienceDialog/div-3" className="space-y-2.5">
              <p data-ui="store/ShareExperienceDialog/p-4" className="text-sm font-semibold text-foreground">
                What did you love about it?
              </p>
              <ul data-ui="store/ShareExperienceDialog/ul" className="divide-y rounded-2xl border bg-card px-4">
                {REVIEW_ASPECTS.map((aspect) => {
                  const vote = aspectVotes[aspect]
                  return (
                    <li
                      data-ui="store/ShareExperienceDialog/li-flex"
                      key={aspect}
                      className="flex items-center justify-between gap-3 py-2.5 text-sm"
                    >
                      <span data-ui="store/ShareExperienceDialog/span-2" className="text-muted-foreground">
                        {aspect}
                      </span>
                      <div data-ui="store/ShareExperienceDialog/div-flex-3" className="flex items-center gap-2">
                        <button
                          data-ui="store/ShareExperienceDialog/button"
                          type="button"
                          aria-label={`Liked ${aspect}`}
                          aria-pressed={vote === "up"}
                          onClick={() => toggleAspect(aspect, "up")}
                          className={cn(
                            "grid size-8 place-items-center rounded-full border transition-colors",
                            vote === "up"
                              ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                              : "border-transparent text-muted-foreground/60 hover:bg-muted hover:text-foreground"
                          )}
                        >
                          <ThumbsUpIcon className="size-4" />
                        </button>
                        <button
                          data-ui="store/ShareExperienceDialog/button-2"
                          type="button"
                          aria-label={`Disliked ${aspect}`}
                          aria-pressed={vote === "down"}
                          onClick={() => toggleAspect(aspect, "down")}
                          className={cn(
                            "grid size-8 place-items-center rounded-full border transition-colors",
                            vote === "down"
                              ? "border-destructive/40 bg-destructive/12 text-destructive"
                              : "border-transparent text-muted-foreground/60 hover:bg-muted hover:text-foreground"
                          )}
                        >
                          <ThumbsDownIcon className="size-4" />
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

          <DialogFooter className="sm:flex-col">
            <Button
              data-ui="store/ShareExperienceDialog/Button"
              type="submit"
              size="lg"
              disabled={pending}
              className="w-full rounded-xl text-base font-semibold"
            >
              {pending && <Loader2Icon className="animate-spin" />}
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
    <div data-ui="store/OrderItemReviewWidget" className="mt-2.5 rounded-2xl border bg-muted/35 p-3">
      <div data-ui="store/OrderItemReviewWidget/div-flex" className="flex flex-wrap items-center justify-between gap-2">
        <div data-ui="store/OrderItemReviewWidget/div">
          <p data-ui="store/OrderItemReviewWidget/p" className="text-[11px] font-semibold tracking-wider text-primary uppercase">
            Rate your experience
          </p>
          <p data-ui="store/OrderItemReviewWidget/p-2" className="text-xs font-medium text-foreground/85">
            {myReview ? "Your product rating (tap a star to edit)" : "Rate a product"}
          </p>
        </div>
        {myReview && (
          <Link
            data-ui="store/OrderItemReviewWidget/Link-view-reviews"
            href={`/products/${item.slug}#customer-reviews`}
            className="text-[11px] font-semibold text-primary underline-offset-4 hover:underline"
          >
            View reviews →
          </Link>
        )}
      </div>

      <div data-ui="store/OrderItemReviewWidget/div-2" className="mt-2">
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
  product: Pick<Product, "id" | "slug" | "name" | "ratingAvg" | "reviewCount"> & { images?: string[] }
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

  const totalCount = Math.max(initialReviews.length, product.reviewCount ?? 0)

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

  return (
    <section
      data-ui="store/ProductReviewsSection"
      id="customer-reviews"
      className="container-page mt-12 scroll-mt-24 border-t pt-10 sm:mt-20 sm:pt-14"
      aria-labelledby="reviews-heading"
    >
      <div data-ui="store/ProductReviewsSection/div-grid" className="grid gap-6 lg:grid-cols-[360px_1fr] lg:items-stretch lg:gap-8">
        {/* Left summary + Rate your experience column (equal height with right column) */}
        <div data-ui="store/ProductReviewsSection/div-flex" className="flex h-full flex-col justify-between gap-5 rounded-3xl border bg-card p-5 sm:p-6">
          <div data-ui="store/ProductReviewsSection/div" className="space-y-5">
            <div data-ui="store/ProductReviewsSection/div-2">
              <p data-ui="store/ProductReviewsSection/p" className="text-xs font-semibold tracking-widest text-primary uppercase">
                Verified buyers
              </p>
              <h2 data-ui="store/ProductReviewsSection/h2-customer-reviews" id="reviews-heading" className="mt-1 text-2xl font-semibold">
                Customer reviews
              </h2>
            </div>

            <div data-ui="store/ProductReviewsSection/div-flex-2" className="flex items-center gap-3.5">
              <span data-ui="store/ProductReviewsSection/span" className="font-heading text-4xl font-bold tabular-nums">
                {totalCount > 0 ? avgRating.toFixed(1) : "0.0"}
              </span>
              <div data-ui="store/ProductReviewsSection/div-3" className="space-y-1">
                <StarRow rating={totalCount > 0 ? avgRating : 0} size="md" />
                <p data-ui="store/ProductReviewsSection/p-2" className="text-xs text-muted-foreground">
                  {totalCount > 0
                    ? `Based on ${totalCount} verified ${totalCount === 1 ? "review" : "reviews"}`
                    : "No verified reviews yet — be the first!"}
                </p>
              </div>
            </div>

            <div data-ui="store/ProductReviewsSection/div-4" className="space-y-2 border-t pt-4">
              {distribution.map((row) => (
                <div data-ui="store/ProductReviewsSection/div-flex-3" key={row.stars} className="flex items-center gap-2.5 text-xs">
                  <span data-ui="store/ProductReviewsSection/span-2" className="w-11 shrink-0 font-medium text-muted-foreground tabular-nums">
                    {row.stars} star
                  </span>
                  <div data-ui="store/ProductReviewsSection/div-5" className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      data-ui="store/ProductReviewsSection/div-6"
                      className="h-full rounded-full bg-amber-400 transition-all duration-300"
                      style={{ width: `${row.pct}%` }}
                    />
                  </div>
                  <span data-ui="store/ProductReviewsSection/span-3" className="w-7 shrink-0 text-right text-muted-foreground tabular-nums">
                    {row.count}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Rate your experience -> Rate a product -> 5 interactive stars */}
          <div data-ui="store/ProductReviewsSection/div-7" className="mt-auto space-y-3 border-t pt-4">
            <div data-ui="store/ProductReviewsSection/div-8" className="rounded-2xl border bg-muted/35 p-3.5">
              <p data-ui="store/ProductReviewsSection/p-3" className="text-xs font-semibold tracking-wider text-primary uppercase">
                Rate your experience
              </p>
              <p data-ui="store/ProductReviewsSection/p-4" className="mt-0.5 text-xs font-medium text-muted-foreground">
                {myReview ? "Your rating — tap any star to edit your review" : "Rate a product"}
              </p>
              <div data-ui="store/ProductReviewsSection/div-9" className="mt-2.5">
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
                data-ui="store/ProductReviewsSection/Link-sign-in-to-write-a-rev"
                href={`/login?next=${encodeURIComponent(`/products/${product.slug}#customer-reviews`)}`}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full rounded-full")}
              >
                Sign in to write a review
              </Link>
            ) : canReview || myReview ? (
              <Button
                data-ui="store/ProductReviewsSection/Button"
                type="button"
                variant={myReview ? "outline" : "default"}
                onClick={() => openReviewModal()}
                className="w-full rounded-full"
              >
                {myReview ? (
                  <>
                    <PencilIcon className="size-4" /> Edit your review
                  </>
                ) : (
                  <>
                    <MessageSquarePlusIcon className="size-4" /> Write a customer review
                  </>
                )}
              </Button>
            ) : null}
          </div>
        </div>

        {/* Right reviews list column (equal height card with left column) */}
        <div data-ui="store/ProductReviewsSection/div-flex-4" className="flex h-full flex-col justify-between gap-4 overflow-hidden rounded-3xl border bg-card p-5 sm:p-6 lg:h-0 lg:min-h-full">
          {initialReviews.length === 0 ? (
            <div data-ui="store/ProductReviewsSection/div-flex-5" className="flex flex-1 flex-col items-center justify-center gap-2.5 rounded-2xl border border-dashed bg-muted/25 px-6 py-12 text-center">
              <StarRow rating={5} size="md" />
              <p data-ui="store/ProductReviewsSection/p-5" className="mt-1 font-sans text-base font-semibold">
                Be the first to review {product.name}
              </p>
              <p data-ui="store/ProductReviewsSection/p-6" className="max-w-md text-xs/relaxed text-muted-foreground">
                Select a star under &ldquo;Rate your experience&rdquo; to share what you loved about this handmade piece.
              </p>
            </div>
          ) : (
            <>
              <div data-ui="store/ProductReviewsSection/div-flex-6" className="flex min-h-0 flex-1 flex-col gap-4">
                <div data-ui="store/ProductReviewsSection/div-flex-7" className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b pb-3.5">
                  <div data-ui="store/ProductReviewsSection/div-10">
                    <h3 data-ui="store/ProductReviewsSection/h3-verified-customer-feed" className="font-sans text-base font-semibold">
                      Verified customer feedback
                    </h3>
                    <p data-ui="store/ProductReviewsSection/p-7" className="text-xs text-muted-foreground">
                      Real experiences shared by customers after delivery
                    </p>
                  </div>
                  <span data-ui="store/ProductReviewsSection/span-4" className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary tabular-nums">
                    {totalCount} {totalCount === 1 ? "review" : "reviews"}
                  </span>
                </div>

                <ul
                  data-ui="store/ProductReviewsSection/ul"
                  data-slot="reviews-list"
                  className="max-h-96 min-h-0 flex-1 space-y-3.5 overflow-y-auto pr-1 lg:max-h-none"
                >
                  {initialReviews.map((review) => {
                    const isMine = Boolean(user && review.userId === user.id)
                    const canDelete = isMine || isAdmin
                    const aspectPills = extractAspectPills(review.title)
                    const hasCustomTitle = Boolean(review.title && aspectPills.liked.length === 0 && aspectPills.disliked.length === 0)
                    return (
                      <li
                        data-ui="store/ProductReviewsSection/li"
                        key={review.id}
                        className="rounded-2xl border bg-background/60 p-4 transition-colors sm:p-5"
                      >
                        <div data-ui="store/ProductReviewsSection/div-flex-8" className="flex items-start justify-between gap-2">
                          <div data-ui="store/ProductReviewsSection/div-11" className="min-w-0 flex-1 space-y-1.5">
                            <div data-ui="store/ProductReviewsSection/div-flex-9" className="flex flex-wrap items-center gap-2">
                              <StarRow rating={review.rating} />
                              <span data-ui="store/ProductReviewsSection/span-5" className="rounded-md bg-amber-500/12 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                                {RATING_LABELS[review.rating] ?? "Great"}
                              </span>
                              {hasCustomTitle && (
                                <span data-ui="store/ProductReviewsSection/span-6" className="text-sm font-semibold text-foreground">
                                  {review.title}
                                </span>
                              )}
                            </div>
                            <div data-ui="store/ProductReviewsSection/div-flex-10" className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                              <span data-ui="store/ProductReviewsSection/span-7" className="font-medium text-foreground/85">
                                {review.reviewerName}
                              </span>
                              {review.isVerifiedPurchase && (
                                <span data-ui="store/ProductReviewsSection/span-inline-flex" className="inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                                  <CheckCircle2Icon className="size-3" aria-hidden /> Verified purchase
                                </span>
                              )}
                              <span data-ui="store/ProductReviewsSection/span-8" aria-hidden>·</span>
                              <span data-ui="store/ProductReviewsSection/span-9">{formatDate(review.createdAt)}</span>
                            </div>
                          </div>

                          {(isMine || canDelete) && (
                            <div data-ui="store/ProductReviewsSection/div-flex-11" className="-mt-1 -mr-1 flex shrink-0 items-center gap-0.5">
                              {isMine && (
                                <button
                                  data-ui="store/ProductReviewsSection/button-edit-your-review"
                                  type="button"
                                  aria-label="Edit your review"
                                  onClick={() => openReviewModal(review.rating)}
                                  className="grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                >
                                  <PencilIcon className="size-3.5" />
                                </button>
                              )}
                              {canDelete && (
                                <button
                                  data-ui="store/ProductReviewsSection/button-delete-review"
                                  type="button"
                                  aria-label="Delete review"
                                  onClick={() => setDeleteTarget(review)}
                                  className="grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                                >
                                  <Trash2Icon className="size-3.5" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        {(aspectPills.liked.length > 0 || aspectPills.disliked.length > 0) && (
                          <div data-ui="store/ProductReviewsSection/div-flex-12" className="mt-2.5 flex flex-wrap items-center gap-1.5">
                            {aspectPills.liked.map((pill) => (
                              <span
                                data-ui="store/ProductReviewsSection/span-inline-flex-2"
                                key={`up-${pill}`}
                                className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300"
                              >
                                <ThumbsUpIcon className="size-2.5" aria-hidden /> {pill}
                              </span>
                            ))}
                            {aspectPills.disliked.map((pill) => (
                              <span
                                data-ui="store/ProductReviewsSection/span-inline-flex-3"
                                key={`down-${pill}`}
                                className="inline-flex items-center gap-1 rounded-full border border-destructive/25 bg-destructive/10 px-2.5 py-0.5 text-[11px] font-medium text-destructive"
                              >
                                <ThumbsDownIcon className="size-2.5" aria-hidden /> {pill}
                              </span>
                            ))}
                          </div>
                        )}

                        <p data-ui="store/ProductReviewsSection/p-8" className="mt-3 text-sm/relaxed whitespace-pre-line text-foreground/90">
                          {review.comment}
                        </p>
                      </li>
                    )
                  })}
                </ul>
              </div>

              <div data-ui="store/ProductReviewsSection/div-flex-13" className="mt-auto flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-dashed bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
                <span data-ui="store/ProductReviewsSection/span-flex" className="flex items-center gap-1.5">
                  <CheckCircle2Icon className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                  100% genuine reviews from verified delivered orders
                </span>
                {(canReview || myReview) && (
                  <button
                    data-ui="store/ProductReviewsSection/button"
                    type="button"
                    onClick={() => openReviewModal()}
                    className="font-semibold text-primary underline-offset-4 hover:underline"
                  >
                    {myReview ? "Update your review →" : "Add your review →"}
                  </button>
                )}
              </div>
            </>
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
          image: product.images?.[0] ?? null,
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
            This will permanently remove the review by <strong data-ui="store/ProductReviewsSection/strong" className="font-semibold text-foreground">{deleteTarget?.reviewerName}</strong> and recalculate the product&apos;s rating.
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
