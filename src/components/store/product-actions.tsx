"use client"

import { ShoppingBagIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import type { Product } from "@/features/products/types"
import { MAX_QTY_PER_ITEM, useCart } from "@/store/cart"
import { QuantityStepper } from "./quantity-stepper"
import { WhatsAppIcon } from "./brand-icons"
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
      <div className="space-y-3">
        <p className="rounded-2xl bg-muted p-4 text-sm font-medium">
          Sold out for now — handmade pieces take time. Save it to your wishlist and check back soon.
        </p>
        <WishlistButton productId={product.id} productName={product.name} size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <QuantityStepper label={product.name} value={qty} max={max} onChange={setQty} size="lg" />
        {product.stock <= 5 && (
          <span className="text-sm font-medium text-primary">Only {product.stock} left</span>
        )}
      </div>
      <div className="flex gap-3">
        <Button
          size="lg"
          variant="outline"
          className="h-13 flex-1 rounded-full text-base"
          onClick={() => {
            add(line, qty)
            toast.success(`Added ${qty} × “${product.name}” to cart`)
          }}
        >
          <ShoppingBagIcon className="size-5" /> Add to cart
        </Button>
        <WishlistButton productId={product.id} productName={product.name} size="lg" className="size-13" />
      </div>
      <Button
        size="lg"
        className="h-13 w-full rounded-full bg-whatsapp text-base text-white shadow-lg shadow-whatsapp/25 hover:bg-whatsapp/90"
        onClick={() => {
          add(line, qty)
          setOpen(false)
          router.push("/checkout")
        }}
      >
        <WhatsAppIcon className="size-5" /> Buy now on WhatsApp
      </Button>
    </div>
  )
}
