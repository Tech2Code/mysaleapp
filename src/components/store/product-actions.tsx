"use client"

import { PackageXIcon, ShoppingBagIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import type { Product } from "@/features/products/types"
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
      <div data-ui="store/ProductActions/div-grid" className="grid grid-cols-2 gap-2 sm:gap-3">
        <QuantityStepper label={product.name} value={qty} max={max} onChange={setChosen} size="lg" className="h-13 w-full justify-between" />
        <Button data-ui="store/ProductActions/Button-add-to-cart"
          size="lg"
          variant="outline"
          className="h-13 min-w-0 rounded-full px-3 text-sm sm:text-base"
          onClick={addToCart}
        >
          <ShoppingBagIcon className="size-5" /> Add to cart
        </Button>
      </div>
      <div data-ui="store/ProductActions/div-flex-2" className="flex gap-2 sm:gap-3">
        <Button data-ui="store/ProductActions/Button-buy-now-2"
          size="lg"
          className="h-13 min-w-0 flex-1 rounded-full bg-whatsapp-solid text-base text-white shadow-lg shadow-whatsapp/25 hover:bg-whatsapp-solid/90"
          onClick={() => {
            if (inCart + qty > max) toast.info(`Only ${max} available, so your cart is set to ${max}.`)
            add(line, qty)
            setOpen(false)
            router.push("/checkout")
          }}
        >
          Buy now
        </Button>
        <WishlistButton productId={product.id} productName={product.name} size="lg" className="size-13 shrink-0" />
      </div>
    </div>
  )
}
