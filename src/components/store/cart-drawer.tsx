"use client"

import { ArrowRightIcon, ShoppingBagIcon, SparklesIcon, Trash2Icon, TruckIcon } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
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
    <div data-ui="store/FreeShippingBar"
      className={cn(
        "rounded-2xl border p-3.5 text-sm transition-colors",
        unlocked ? "border-success/30 bg-success/10" : "border-primary/15 bg-linear-to-br from-secondary/80 to-accent/40"
      )}
    >
      <p className="flex items-center gap-2 font-medium">
        <span className={cn("grid size-7 shrink-0 place-items-center rounded-full", unlocked ? "bg-success-solid text-white" : "bg-primary/10 text-primary")}>
          {unlocked ? <SparklesIcon className="size-3.5" /> : <TruckIcon className="size-3.5" />}
        </span>
        {unlocked ? (
          <>You&apos;ve unlocked free delivery 🎉</>
        ) : (
          <>
            Add <span className="font-bold">{formatPrice(remaining)}</span> more for free delivery
          </>
        )}
      </p>
      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-background/80">
        <motion.div
          className={cn("h-full rounded-full", unlocked ? "bg-success" : "bg-linear-to-r from-primary to-[oklch(0.6_0.16_15)]")}
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
    <motion.li data-ui="store/DrawerItem"
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
        <motion.span
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute -top-2.5 left-4 rounded-full bg-primary px-2.5 py-0.5 text-[0.65rem] font-bold tracking-wide text-primary-foreground uppercase shadow"
        >
          Just added
        </motion.span>
      )}

      <Link
        href={`/products/${item.slug}`}
        onClick={onNavigate}
        className="relative size-24 shrink-0 overflow-hidden rounded-xl bg-muted @container"
      >
        <ProductImage src={item.image} alt={item.name} sizes="96px" className="transition-transform duration-500 hover:scale-105" />
      </Link>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/products/${item.slug}`} onClick={onNavigate} className="line-clamp-2 text-sm leading-snug font-semibold hover:text-primary">
            {item.name}
          </Link>
          <button
            type="button"
            onClick={onRemove}
            className="-m-1.5 grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            aria-label={`Remove ${item.name}`}
          >
            <Trash2Icon className="size-4" />
          </button>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{formatPrice(item.price)} each</p>

        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <QuantityStepper
            label={item.name}
            value={item.quantity}
            max={Math.min(item.maxQuantity, MAX_QTY_PER_ITEM)}
            onChange={onQuantity}
          />
          <span className="font-heading text-lg font-semibold">{formatPrice(item.price * item.quantity)}</span>
        </div>
      </div>
    </motion.li>
  )
}

/**
 * The slide-in cart. A side panel on larger screens, a bottom sheet on phones.
 * It opens whenever something is added and highlights that item.
 */
export function CartDrawer() {
  const { items, isOpen, setOpen, setQuantity, remove, lastAddedId } = useCart()
  const isPhone = useMediaQuery("(max-width: 639px)")
  const subtotal = cartSubtotal(items)
  const close = () => setOpen(false)

  return (
    <Sheet open={isOpen} onOpenChange={setOpen}>
      <SheetContent
        side={isPhone ? "bottom" : "right"}
        className={cn(
          "gap-0 bg-background p-0",
          isPhone ? "max-h-[92dvh] rounded-t-3xl" : "w-full sm:max-w-md"
        )}
      >
        {isPhone && <span aria-hidden className="mx-auto mt-2.5 mb-1 h-1.5 w-10 shrink-0 rounded-full bg-muted-foreground/25" />}

        <SheetHeader className="flex-row items-center gap-3 border-b px-5 py-4 pr-14">
          <span className="grid size-10 place-items-center rounded-2xl bg-primary/10 text-primary">
            <ShoppingBagIcon className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <SheetTitle className="font-heading text-xl leading-tight">Your cart</SheetTitle>
            <p className="text-xs text-muted-foreground">
              {items.length === 0 ? "Nothing here yet" : `${cartCount(items)} item${cartCount(items) === 1 ? "" : "s"} · ready to checkout`}
            </p>
          </div>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-7 sm:p-10 text-center">
            <div className="grid size-24 place-items-center rounded-full bg-linear-to-br from-secondary to-accent animate-float">
              <ShoppingBagIcon className="size-10 text-primary" />
            </div>
            <p className="font-heading text-2xl">Your cart is empty</p>
            <p className="max-w-60 text-sm text-muted-foreground">Find something handmade you&apos;ll love.</p>
            <Link href="/products" onClick={close} className={cn(buttonVariants({ size: "lg" }), "rounded-full px-7")}>
              Start shopping
            </Link>
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-5">
              <FreeShippingBar subtotal={subtotal} />
              <ul className="space-y-3.5">
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

            <div className="space-y-3 border-t bg-card/80 px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] backdrop-blur">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">Subtotal</span>
                <span className="font-heading text-2xl font-semibold">{formatPrice(subtotal)}</span>
              </div>
              <p className="text-xs text-muted-foreground">Delivery and any product charges are added at checkout.</p>
              <Link
                href="/checkout"
                onClick={close}
                className={cn(buttonVariants({ size: "lg" }), "group w-full rounded-full text-base shadow-lg shadow-primary/25")}
              >
                Checkout <ArrowRightIcon className="transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
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
