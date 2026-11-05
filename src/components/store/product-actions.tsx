"use client"

import { ShoppingBagIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
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
  const [qty, setQty] = useState(1)
  const soldOut = product.stock <= 0
  const max = Math.min(product.stock, MAX_QTY_PER_ITEM)

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
      <div data-ui="store/ProductActions" className="space-y-3">
        <p data-ui="store/ProductActions/p" className="rounded-2xl bg-muted p-4 text-sm font-medium">
          Sold out for now — handmade pieces take time. Save it to your wishlist and check back soon.
        </p>
        <WishlistButton productId={product.id} productName={product.name} size="lg" />
      </div>
    )
  }

  return (
    <div data-ui="store/ProductActions" className="space-y-4">
      <div data-ui="store/ProductActions/div-flex" className="flex items-center gap-3">
        <QuantityStepper label={product.name} value={qty} max={max} onChange={setQty} size="lg" />
        {product.stock <= 5 && (
          <span data-ui="store/ProductActions/span" className="text-sm font-medium text-primary">Only {product.stock} left</span>
        )}
      </div>
      <div data-ui="store/ProductActions/div-flex-2" className="flex gap-3">
        <Button data-ui="store/ProductActions/Button-add-to-cart"
          size="lg"
          variant="outline"
          className="h-13 flex-1 rounded-full text-base"
          onClick={() => {
            add(line, qty)
          }}
        >
          <ShoppingBagIcon className="size-5" /> Add to cart
        </Button>
        <WishlistButton productId={product.id} productName={product.name} size="lg" className="size-13" />
      </div>
      <Button data-ui="store/ProductActions/Button-buy-now"
        size="lg"
        className="h-13 w-full rounded-full bg-whatsapp-solid text-base text-white shadow-lg shadow-whatsapp/25 hover:bg-whatsapp-solid/90"
        onClick={() => {
          add(line, qty)
          setOpen(false)
          router.push("/checkout")
        }}
      >
        Buy now
      </Button>
    </div>
  )
}
