"use client"

import { ShoppingBagIcon, Trash2Icon, TruckIcon } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { siteConfig } from "@/config/site"
import { formatPrice } from "@/lib/format"
import { cn } from "@/lib/utils"
import { cartCount, cartSubtotal, MAX_QTY_PER_ITEM, useCart } from "@/store/cart"
import { ProductImage } from "./product-image"
import { QuantityStepper } from "./quantity-stepper"

export function FreeShippingBar({ subtotal }: { subtotal: number }) {
  const threshold = siteConfig.freeShippingAbove
  if (!threshold) return null
  const remaining = Math.max(0, threshold - subtotal)
  const pct = Math.min(100, (subtotal / threshold) * 100)
  return (
    <div className="rounded-xl bg-secondary/70 p-3 text-sm">
      <p className="flex items-center gap-2 font-medium">
        <TruckIcon className="size-4 text-primary" />
        {remaining > 0 ? (
          <>Add {formatPrice(remaining)} more for free delivery</>
        ) : (
          <>Yay! You&apos;ve unlocked free delivery 🎉</>
        )}
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-background">
        <motion.div
          className="h-full rounded-full bg-linear-to-r from-primary to-[oklch(0.6_0.16_15)]"
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 20 }}
        />
      </div>
    </div>
  )
}

export function CartDrawer() {
  const { items, isOpen, setOpen, setQuantity, remove } = useCart()
  const subtotal = cartSubtotal(items)

  return (
    <Sheet open={isOpen} onOpenChange={setOpen}>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle className="font-heading text-xl">
            Your cart {items.length > 0 && <span className="text-muted-foreground">({cartCount(items)})</span>}
          </SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="grid size-20 place-items-center rounded-full bg-secondary animate-float">
              <ShoppingBagIcon className="size-8 text-primary" />
            </div>
            <p className="font-heading text-xl">Your cart is empty</p>
            <p className="text-sm text-muted-foreground">Find something handmade you&apos;ll love.</p>
            <Link href="/products" onClick={() => setOpen(false)} className={cn(buttonVariants(), "rounded-full px-6")}>
              Start shopping
            </Link>
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              <FreeShippingBar subtotal={subtotal} />
              <ul className="space-y-3">
                <AnimatePresence initial={false}>
                  {items.map((item) => (
                    <motion.li
                      key={item.productId}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: 40, height: 0, marginTop: 0 }}
                      transition={{ duration: 0.25 }}
                      className="flex gap-3 rounded-2xl border bg-card p-2.5"
                    >
                      <Link
                        href={`/products/${item.slug}`}
                        onClick={() => setOpen(false)}
                        className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-muted @container"
                      >
                        <ProductImage src={item.image} alt={item.name} sizes="80px" />
                      </Link>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <div className="flex items-start justify-between gap-2">
                          <p className="line-clamp-2 text-sm font-semibold">{item.name}</p>
                          <button
                            type="button"
                            onClick={() => remove(item.productId)}
                            className="-m-1 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                            aria-label={`Remove ${item.name}`}
                          >
                            <Trash2Icon className="size-4" />
                          </button>
                        </div>
                        <div className="mt-auto flex items-center justify-between">
                          <QuantityStepper
                            label={item.name}
                            value={item.quantity}
                            max={Math.min(item.maxQuantity, MAX_QTY_PER_ITEM)}
                            onChange={(q) => setQuantity(item.productId, q)}
                          />
                          <span className="font-bold">{formatPrice(item.price * item.quantity)}</span>
                        </div>
                      </div>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            </div>

            <SheetFooter className="border-t bg-muted/30">
              <div className="flex items-baseline justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-heading text-2xl font-semibold">{formatPrice(subtotal)}</span>
              </div>
              <p className="text-xs text-muted-foreground">Delivery charges (if any) are confirmed on WhatsApp.</p>
              <Link
                href="/checkout"
                onClick={() => setOpen(false)}
                className={cn(buttonVariants({ size: "lg" }), "h-12 rounded-full text-base shadow-lg shadow-primary/25")}
              >
                Checkout on WhatsApp
              </Link>
              <Link
                href="/cart"
                onClick={() => setOpen(false)}
                className="text-center text-sm font-medium text-muted-foreground underline-offset-4 hover:underline"
              >
                View full cart
              </Link>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
