"use client"

import { AlertTriangleIcon, ArrowRightIcon, ShoppingBagIcon, Trash2Icon } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import Link from "next/link"
import { PriceBreakdown } from "@/components/shared/price-breakdown"
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
  const { ready, lines, hasUnavailable, subtotal, charges } = useLiveCart(products)
  const setQuantity = useCart((s) => s.setQuantity)
  const remove = useCart((s) => s.remove)

  if (!ready) {
    return (
      <div data-ui="store/CartView" className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <div data-ui="store/CartView/div" className="space-y-3">
          {[0, 1].map((i) => (
            <Skeleton data-ui="store/CartView/Skeleton" key={i} className="h-32 rounded-3xl" />
          ))}
        </div>
        <Skeleton data-ui="store/CartView/Skeleton-2" className="h-64 rounded-3xl" />
      </div>
    )
  }

  if (lines.length === 0) {
    return (
      <div data-ui="store/CartView" className="flex flex-col items-center gap-4 rounded-3xl border border-dashed py-14 sm:py-20 text-center">
        <div data-ui="store/CartView/div-grid" className="grid size-20 place-items-center rounded-full bg-secondary animate-float">
          <ShoppingBagIcon className="size-8 text-primary" />
        </div>
        <p data-ui="store/CartView/p" className="font-heading text-2xl">Your cart is empty</p>
        <Link data-ui="store/CartView/Link-start-shopping" href="/products" className={cn(buttonVariants({ size: "lg" }), "rounded-full px-6")}>
          Start shopping
        </Link>
      </div>
    )
  }

  return (
    <div data-ui="store/CartView" className="grid gap-8 lg:grid-cols-[1fr_380px]">
      <div data-ui="store/CartView/div-2" className="space-y-3">
        {hasUnavailable && (
          <p data-ui="store/CartView/p-flex" className="flex items-center gap-2 rounded-2xl bg-destructive/10 p-4 text-sm font-medium text-destructive">
            <AlertTriangleIcon className="size-4 shrink-0" />
            Some items are sold out or no longer available. Please remove them to continue.
          </p>
        )}
        <ul data-ui="store/CartView/ul" className="space-y-3">
          <AnimatePresence initial={false}>
            {lines.map((item) => (
              <motion.li data-ui="store/CartView/m-li"
                key={item.productId}
                layout
                exit={{ opacity: 0, x: -40 }}
                className={cn("flex gap-4 rounded-3xl border bg-card p-3 sm:p-4", !item.available && "opacity-60")}
              >
                <Link data-ui="store/CartView/Link-relative"
                  href={`/products/${item.slug}`}
                  className="relative size-24 shrink-0 overflow-hidden rounded-2xl bg-muted @container sm:size-28"
                >
                  <ProductImage src={item.image} alt={item.name} sizes="112px" />
                </Link>
                <div data-ui="store/CartView/div-flex" className="flex min-w-0 flex-1 flex-col gap-2">
                  <div data-ui="store/CartView/div-flex-2" className="flex items-start justify-between gap-2">
                    <div data-ui="store/CartView/div-3">
                      <Link data-ui="store/CartView/Link" href={`/products/${item.slug}`} className="font-semibold hover:text-primary">
                        {item.name}
                      </Link>
                      <p data-ui="store/CartView/p-2" className="text-sm text-muted-foreground">
                        {item.available ? formatPrice(item.price) : "Unavailable"}
                        {item.priceChanged && <span data-ui="store/CartView/span" className="ml-2 text-xs text-primary">(price updated)</span>}
                      </p>
                      {item.available && item.fees.length > 0 && (
                        <p data-ui="store/CartView/p-3" className="mt-1 inline-block rounded-lg bg-secondary/70 px-2 py-1 text-xs text-muted-foreground">
                          + {item.fees.map((f) => `${formatPrice(f.amount)} ${f.label.toLowerCase()}`).join(", ")} (once for this product)
                        </p>
                      )}
                    </div>
                    <button data-ui="store/CartView/button"
                      type="button"
                      onClick={() => remove(item.productId)}
                      className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      aria-label={`Remove ${item.name}`}
                    >
                      <Trash2Icon className="size-4" />
                    </button>
                  </div>
                  {item.available && (
                    <div data-ui="store/CartView/div-flex-3" className="mt-auto flex items-center justify-between">
                      <QuantityStepper
                        label={item.name}
                        value={item.quantity}
                        max={Math.min(item.maxQuantity, MAX_QTY_PER_ITEM)}
                        onChange={(q) => setQuantity(item.productId, q)}
                      />
                      <span data-ui="store/CartView/span-2" className="text-lg font-bold">{formatPrice(item.price * item.quantity)}</span>
                    </div>
                  )}
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </div>

      <aside data-ui="store/CartView/aside" className="h-fit space-y-4 rounded-3xl border bg-card p-6 lg:sticky-store">
        <h2 data-ui="store/CartView/h2-order-summary" className="flex items-baseline justify-between gap-3 text-xl font-semibold">
          Order summary
          <span data-ui="store/CartView/span-3" className="text-sm font-medium text-muted-foreground">
            {lines.reduce((n, l) => n + l.quantity, 0)} item{lines.reduce((n, l) => n + l.quantity, 0) === 1 ? "" : "s"}
          </span>
        </h2>
        <FreeShippingBar subtotal={subtotal} />
        <PriceBreakdown {...charges} />
        <p data-ui="store/CartView/p-4" className="rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">
          <span data-ui="store/CartView/span-4" className="font-semibold text-foreground">Pay by UPI after placing your order.</span> Cash on delivery isn&apos;t available.
        </p>
        <Link data-ui="store/CartView/Link-proceed-to-checkout"
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
