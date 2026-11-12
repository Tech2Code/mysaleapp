"use client"

import { PackageXIcon, ShoppingBagIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import type { Product } from "@/features/products/types"
import { formatPrice } from "@/lib/format"
import { MAX_QTY_PER_ITEM, useCart } from "@/store/cart"
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
    if (inCart + qty > max) {
      toast.info(
        inCart >= max
          ? `You already have the most we can offer (${max}) in your cart.`
          : `Only ${max} available, so your cart is set to ${max}.`
      )
    }
    add(line, qty)
  }

  const buyNow = () => {
    if (inCart + qty > max) toast.info(`Only ${max} available, so your cart is set to ${max}.`)
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
        <p data-ui="store/ProductActions/p" className="text-sm font-medium text-destructive">Only {product.stock} left</p>
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
        <Button data-ui="store/ProductActions/Button-buy-now-2"
          size="lg"
          className="h-13 min-w-0 flex-1 rounded-full bg-whatsapp-solid text-base text-white shadow-lg shadow-whatsapp/25 hover:bg-whatsapp-solid/90"
          onClick={buyNow}
        >
          Buy now
        </Button>
        <WishlistButton productId={product.id} productName={product.name} size="lg" className="size-13 shrink-0" />
      </div>

      {/* Native Android e-commerce sticky bottom buy bar on phones */}
      <div
        data-ui="store/ProductActions/div-flex-2"
        data-mobile-bottom-bar
        className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-2.5 border-t border-border/80 bg-background/95 px-3.5 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_28px_-8px_rgb(0_0_0/0.16)] backdrop-blur-xl sm:hidden in-[data-skeleton]:hidden"
      >
        <div data-ui="store/ProductActions/div" className="min-w-0 pr-1">
          <p data-ui="store/ProductActions/p-2" className="text-[0.65rem] font-medium text-muted-foreground uppercase">Total</p>
          <p data-ui="store/ProductActions/p-3" className="font-heading text-lg/tight font-bold">{formatPrice(product.price * qty)}</p>
        </div>
        <Button
          data-ui="store/ProductActions/Button-add-to-cart-2"
          size="lg"
          variant="outline"
          className="h-11 min-w-0 flex-1 rounded-full px-3 text-xs font-semibold active:scale-97"
          onClick={addToCart}
        >
          <ShoppingBagIcon className="size-4" /> Add to cart
        </Button>
        <Button
          data-ui="store/ProductActions/Button-buy-now-3"
          size="lg"
          className="h-11 min-w-0 flex-1 rounded-full bg-whatsapp-solid px-3 text-xs font-semibold text-white shadow-md shadow-whatsapp/25 active:scale-97 hover:bg-whatsapp-solid/90"
          onClick={buyNow}
        >
          Buy now
        </Button>
      </div>
    </div>
  )
}
