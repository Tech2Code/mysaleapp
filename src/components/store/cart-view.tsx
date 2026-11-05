"use client"

import { AlertTriangleIcon, ArrowRightIcon, ShoppingBagIcon, Trash2Icon } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { formatPrice } from "@/lib/format"
import { cn } from "@/lib/utils"
import { MAX_QTY_PER_ITEM, useCart } from "@/store/cart"
import { FreeShippingBar } from "./cart-drawer"
import { useLiveCart, type LiveProduct } from "./live-cart"
import { ProductImage } from "./product-image"
import { QuantityStepper } from "./quantity-stepper"

export function CartView({ products }: { products: LiveProduct[] }) {
  const { ready, lines, hasUnavailable, subtotal, count } = useLiveCart(products)
  const setQuantity = useCart((s) => s.setQuantity)
  const remove = useCart((s) => s.remove)

  if (!ready) {
    return (
      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-32 rounded-3xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-3xl" />
      </div>
    )
  }

  if (lines.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-3xl border border-dashed py-20 text-center">
        <div className="grid size-20 place-items-center rounded-full bg-secondary animate-float">
          <ShoppingBagIcon className="size-8 text-primary" />
        </div>
        <p className="font-heading text-2xl">Your cart is empty</p>
        <Link href="/products" className={cn(buttonVariants({ size: "lg" }), "rounded-full px-6")}>
          Start shopping
        </Link>
      </div>
    )
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
      <div className="space-y-3">
        {hasUnavailable && (
          <p className="flex items-center gap-2 rounded-2xl bg-destructive/10 p-4 text-sm font-medium text-destructive">
            <AlertTriangleIcon className="size-4 shrink-0" />
            Some items are sold out or no longer available. Please remove them to continue.
          </p>
        )}
        <ul className="space-y-3">
          <AnimatePresence initial={false}>
            {lines.map((item) => (
              <motion.li
                key={item.productId}
                layout
                exit={{ opacity: 0, x: -40 }}
                className={cn("flex gap-4 rounded-3xl border bg-card p-3 sm:p-4", !item.available && "opacity-60")}
              >
                <Link
                  href={`/products/${item.slug}`}
                  className="relative size-24 shrink-0 overflow-hidden rounded-2xl bg-muted @container sm:size-28"
                >
                  <ProductImage src={item.image} alt={item.name} sizes="112px" />
                </Link>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <Link href={`/products/${item.slug}`} className="font-semibold hover:text-primary">
                        {item.name}
                      </Link>
                      <p className="text-sm text-muted-foreground">
                        {item.available ? formatPrice(item.price) : "Unavailable"}
                        {item.priceChanged && <span className="ml-2 text-xs text-primary">(price updated)</span>}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => remove(item.productId)}
                      className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      aria-label={`Remove ${item.name}`}
                    >
                      <Trash2Icon className="size-4" />
                    </button>
                  </div>
                  {item.available && (
                    <div className="mt-auto flex items-center justify-between">
                      <QuantityStepper
                        label={item.name}
                        value={item.quantity}
                        max={Math.min(item.maxQuantity, MAX_QTY_PER_ITEM)}
                        onChange={(q) => setQuantity(item.productId, q)}
                      />
                      <span className="text-lg font-bold">{formatPrice(item.price * item.quantity)}</span>
                    </div>
                  )}
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </div>

      <aside className="h-fit space-y-4 rounded-3xl border bg-card p-6 lg:sticky lg:top-24">
        <h2 className="text-xl font-semibold">Order summary</h2>
        <FreeShippingBar subtotal={subtotal} />
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Items ({count})</dt>
            <dd className="font-medium">{formatPrice(subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Delivery</dt>
            <dd className="font-medium">Confirmed on WhatsApp</dd>
          </div>
          <div className="flex justify-between border-t pt-3 text-base">
            <dt className="font-semibold">Subtotal</dt>
            <dd className="font-heading text-2xl font-semibold">{formatPrice(subtotal)}</dd>
          </div>
        </dl>
        <Link
          href="/checkout"
          aria-disabled={hasUnavailable}
          className={cn(
            buttonVariants({ size: "lg" }),
            "group h-12 w-full rounded-full text-base shadow-lg shadow-primary/25",
            hasUnavailable && "pointer-events-none opacity-50"
          )}
        >
          Proceed to checkout <ArrowRightIcon className="transition-transform group-hover:translate-x-1" />
        </Link>
      </aside>
    </div>
  )
}
