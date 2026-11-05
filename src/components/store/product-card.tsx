"use client"

import { PlusIcon } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import type { Product } from "@/features/products/types"
import { discountPercent, formatPrice } from "@/lib/format"
import { useCart } from "@/store/cart"
import { ProductImage } from "./product-image"
import { WishlistButton } from "./wishlist-button"

export type ProductCardData = Pick<
  Product,
  "id" | "slug" | "name" | "price" | "compareAtPrice" | "images" | "stock" | "category"
>

export function ProductCard({ product, priority }: { product: ProductCardData; priority?: boolean }) {
  const add = useCart((s) => s.add)
  const off = discountPercent(product.price, product.compareAtPrice)
  const soldOut = product.stock <= 0

  return (
    <article className="group relative flex h-full flex-col">
      <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-muted @container">
        <Link href={`/products/${product.slug}`} className="absolute inset-0" aria-label={product.name}>
          <ProductImage
            src={product.images[0]}
            alt={product.name}
            priority={priority}
            sizes="(min-width: 1280px) 22vw, (min-width: 768px) 30vw, 50vw"
            className="transition-transform duration-700 ease-out group-hover:scale-[1.06]"
          />
          <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
        </Link>

        <div className="pointer-events-none absolute top-3 left-3 flex flex-col gap-1.5">
          {off && (
            <span className="rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground shadow">
              {off}% off
            </span>
          )}
          {soldOut && (
            <span className="rounded-full bg-foreground/80 px-2.5 py-1 text-xs font-semibold text-background">
              Sold out
            </span>
          )}
        </div>

        <WishlistButton productId={product.id} productName={product.name} className="absolute top-3 right-3" />

        {!soldOut && (
          <button
            type="button"
            onClick={() => {
              add({
                productId: product.id,
                slug: product.slug,
                name: product.name,
                price: product.price,
                image: product.images[0] ?? null,
                maxQuantity: product.stock,
              })
              toast.success(`Added “${product.name}” to cart`)
            }}
            aria-label={`Add ${product.name} to cart`}
            className="absolute right-3 bottom-3 grid size-10 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-all duration-300 hover:scale-110 focus-visible:translate-y-0 focus-visible:opacity-100 md:translate-y-2 md:opacity-0 md:group-hover:translate-y-0 md:group-hover:opacity-100"
          >
            <PlusIcon className="size-5" />
          </button>
        )}
      </div>

      <div className="mt-3 flex flex-1 flex-col gap-1 px-0.5">
        {product.category && (
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {product.category.name}
          </span>
        )}
        <h3 className="font-sans text-[0.95rem] leading-snug font-semibold">
          <Link href={`/products/${product.slug}`} className="line-clamp-2 hover:text-primary">
            {product.name}
          </Link>
        </h3>
        <div className="mt-auto flex items-baseline gap-2 pt-1">
          <span className="text-base font-bold">{formatPrice(product.price)}</span>
          {product.compareAtPrice && (
            <span className="text-sm text-muted-foreground line-through">
              {formatPrice(product.compareAtPrice)}
            </span>
          )}
        </div>
      </div>
    </article>
  )
}
