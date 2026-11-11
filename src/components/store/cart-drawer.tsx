"use client"

import { ArrowRightIcon, ShoppingBagIcon, SparklesIcon, Trash2Icon, TruckIcon } from "lucide-react"
import { AnimatePresence } from "motion/react"
import * as m from "motion/react-m"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { useMediaQuery } from "@/hooks/use-media-query"
import { formatPrice } from "@/lib/format"
import { cn } from "@/lib/utils"
import { cartCount, cartSubtotal, MAX_QTY_PER_ITEM, useCart, type CartItem } from "@/store/cart"
import { ProductImage } from "./product-image"
import { QuantityStepper } from "./quantity-stepper"
import { useStoreSettings } from "./store-settings-provider"

/** "Add ₹X more for free delivery" with a progress bar. Used in the drawer, the cart page and checkout. */
export function FreeShippingBar({ subtotal }: { subtotal: number }) {
  const threshold = useStoreSettings().freeDeliveryAbove
  if (!threshold) return null
  const remaining = Math.max(0, threshold - subtotal)
  const pct = Math.min(100, (subtotal / threshold) * 100)
  const unlocked = remaining === 0

  return (
    <div
      data-ui="store/FreeShippingBar"
      className={cn(
        "rounded-xl border px-3 py-2 text-xs transition-all",
        unlocked
          ? "border-emerald-500/30 bg-emerald-50/70 text-emerald-950 dark:bg-emerald-950/20 dark:text-emerald-200"
          : "border-border/60 bg-muted/40"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p data-ui="store/FreeShippingBar/p-flex" className="flex items-center gap-1.5 font-medium leading-tight">
          {unlocked ? (
            <SparklesIcon className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          ) : (
            <TruckIcon className="size-3.5 text-primary shrink-0" />
          )}
          {unlocked ? (
            <span>You unlocked <strong>Free Delivery</strong> 🎉</span>
          ) : (
            <span>
              Add <strong className="text-foreground font-semibold">{formatPrice(remaining)}</strong> more for <strong className="text-primary font-semibold">Free Delivery</strong>
            </span>
          )}
        </p>
        <span className="text-[10px] font-semibold text-muted-foreground tabular-nums">
          {Math.round(pct)}%
        </span>
      </div>
      <div data-ui="store/FreeShippingBar/div" className="mt-1.5 h-1 overflow-hidden rounded-full bg-border/40">
        <m.div
          data-ui="store/FreeShippingBar/m.div"
          className={cn("h-full rounded-full transition-all", unlocked ? "bg-emerald-500" : "bg-primary")}
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 20 }}
        />
      </div>
    </div>
  )
}

function DrawerItem({
  item,
  highlighted,
  onNavigate,
  onQuantity,
  onRemove,
}: {
  item: CartItem
  highlighted: boolean
  onNavigate: () => void
  onQuantity: (q: number) => void
  onRemove: () => void
}) {
  return (
    <m.li data-ui="store/DrawerItem"
      layout
      initial={{ opacity: 0, y: 14, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 48, transition: { duration: 0.2 } }}
      transition={{ type: "spring", stiffness: 380, damping: 32 }}
      className={cn(
        "relative flex gap-3.5 rounded-2xl border bg-card p-3 transition-shadow duration-500",
        highlighted && "border-primary/40 shadow-lg ring-2 shadow-primary/10 ring-primary/25"
      )}
    >
      {highlighted && (
        <m.span data-ui="store/DrawerItem/m.span-absolute"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute -top-2.5 left-4 rounded-full bg-primary px-2.5 py-0.5 text-[0.65rem] font-bold tracking-wide text-primary-foreground uppercase shadow"
        >
          Just added
        </m.span>
      )}

      <Link data-ui="store/DrawerItem/Link-relative"
        href={`/products/${item.slug}`}
        onClick={onNavigate}
        className="relative size-24 shrink-0 overflow-hidden rounded-xl bg-muted @container"
      >
        <ProductImage src={item.image} alt={item.name} sizes="96px" className="transition-transform duration-500 hover:scale-105" />
      </Link>

      <div data-ui="store/DrawerItem/div-flex" className="flex min-w-0 flex-1 flex-col">
        <div data-ui="store/DrawerItem/div-flex-2" className="flex items-start justify-between gap-2">
          <Link data-ui="store/DrawerItem/Link" href={`/products/${item.slug}`} onClick={onNavigate} className="line-clamp-2 text-sm/snug  font-semibold hover:text-primary">
            {item.name}
          </Link>
          <button data-ui="store/DrawerItem/button-grid"
            type="button"
            onClick={onRemove}
            className="-m-1.5 grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            aria-label={`Remove ${item.name}`}
          >
            <Trash2Icon className="size-4" />
          </button>
        </div>
        <p data-ui="store/DrawerItem/p" className="mt-0.5 text-xs text-muted-foreground">{formatPrice(item.price)} each</p>

        <div data-ui="store/DrawerItem/div-flex-3" className="mt-auto flex items-center justify-between gap-2 pt-2">
          <QuantityStepper
            label={item.name}
            value={item.quantity}
            max={Math.min(item.maxQuantity, MAX_QTY_PER_ITEM)}
            onChange={onQuantity}
          />
          <span data-ui="store/DrawerItem/span" className="font-heading text-lg font-semibold">{formatPrice(item.price * item.quantity)}</span>
        </div>
      </div>
    </m.li>
  )
}

/**
 * The slide-in cart. A side panel on larger screens, a bottom sheet on phones.
 * It opens whenever something is added and highlights that item.
 */
export function CartDrawer() {
  const items = useCart((s) => s.items)
  const isOpen = useCart((s) => s.isOpen)
  const lastAddedId = useCart((s) => s.lastAddedId)
  const setOpen = useCart((s) => s.setOpen)
  const setQuantity = useCart((s) => s.setQuantity)
  const remove = useCart((s) => s.remove)
  const isPhone = useMediaQuery("(max-width: 639px)")
  const subtotal = cartSubtotal(items)
  const close = () => setOpen(false)

  return (
    <Sheet open={isOpen} onOpenChange={setOpen}>
      <SheetContent data-ui="store/CartDrawer/SheetContent"
        side={isPhone ? "bottom" : "right"}
        className={cn(
          "gap-0 bg-background p-0",
          isPhone ? "max-h-[92dvh] rounded-t-3xl" : "w-full sm:max-w-md"
        )}
      >
        {isPhone && <span data-ui="store/CartDrawer/span" aria-hidden className="mx-auto mt-2.5 mb-1 h-1.5 w-10 shrink-0 rounded-full bg-muted-foreground/25" />}

        <SheetHeader className="flex-row items-center gap-3 border-b px-5 py-4 pr-14">
          <span data-ui="store/CartDrawer/span-grid" className="grid size-10 place-items-center rounded-2xl bg-primary/10 text-primary">
            <ShoppingBagIcon className="size-5" aria-hidden />
          </span>
          <div data-ui="store/CartDrawer/div" className="min-w-0">
            <SheetTitle className="font-heading text-xl/tight ">Your cart</SheetTitle>
            <p data-ui="store/CartDrawer/p" className="text-xs text-muted-foreground">
              {items.length === 0 ? "Nothing here yet" : `${cartCount(items)} item${cartCount(items) === 1 ? "" : "s"} · ready to checkout`}
            </p>
          </div>
        </SheetHeader>

        {items.length === 0 ? (
          <div data-ui="store/CartDrawer/div-flex" className="flex flex-1 flex-col items-center justify-center gap-4 p-7 sm:p-10 text-center">
            <div data-ui="store/CartDrawer/div-grid" className="grid size-24 place-items-center rounded-full bg-linear-to-br from-secondary to-accent animate-float">
              <ShoppingBagIcon className="size-10 text-primary" />
            </div>
            <p data-ui="store/CartDrawer/p-2" className="font-heading text-2xl">Your cart is empty</p>
            <p data-ui="store/CartDrawer/p-3" className="max-w-60 text-sm text-muted-foreground">Find something you&apos;ll love.</p>
            <Link data-ui="store/CartDrawer/Link-start-shopping" href="/products" onClick={close} className={cn(buttonVariants({ size: "lg" }), "rounded-full px-7")}>
              Start shopping
            </Link>
          </div>
        ) : (
          <>
            <div data-ui="store/CartDrawer/div-2" className="flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-5">
              <FreeShippingBar subtotal={subtotal} />
              <ul data-ui="store/CartDrawer/ul" className="space-y-3.5">
                <AnimatePresence initial={false} mode="popLayout">
                  {items.map((item) => (
                    <DrawerItem
                      key={item.productId}
                      item={item}
                      highlighted={item.productId === lastAddedId}
                      onNavigate={close}
                      onQuantity={(q) => setQuantity(item.productId, q)}
                      onRemove={() => remove(item.productId)}
                    />
                  ))}
                </AnimatePresence>
              </ul>
            </div>

            <div data-ui="store/CartDrawer/div-3" className="space-y-3 border-t bg-card/80 px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] backdrop-blur">
              <div data-ui="store/CartDrawer/div-flex-2" className="flex items-baseline justify-between">
                <span data-ui="store/CartDrawer/span-2" className="text-sm text-muted-foreground">Subtotal</span>
                <span data-ui="store/CartDrawer/span-3" className="font-heading text-2xl font-semibold">{formatPrice(subtotal)}</span>
              </div>
              <p data-ui="store/CartDrawer/p-4" className="text-xs text-muted-foreground">Delivery and any product charges are added at checkout.</p>
              <Link data-ui="store/CartDrawer/Link-checkout"
                href="/checkout"
                onClick={close}
                className={cn(buttonVariants({ size: "lg" }), "group w-full rounded-full text-base shadow-lg shadow-primary/25")}
              >
                Checkout <ArrowRightIcon className="transition-transform group-hover:translate-x-1" />
              </Link>
              <Link data-ui="store/CartDrawer/Link-view-full-cart"
                href="/cart"
                onClick={close}
                className="block text-center text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                View full cart
              </Link>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
