"use client"

import { PlusIcon } from "lucide-react"
import Link from "next/link"
import { memo } from "react"
import type { ProductCardData } from "@/features/products/types"
import { discountPercent, formatPrice } from "@/lib/format"
import { useCart } from "@/store/cart"
import { ProductImage } from "./product-image"
import { WishlistButton } from "./wishlist-button"

export type { ProductCardData }

export const ProductCard = memo(function ProductCard({ product, priority }: { product: ProductCardData; priority?: boolean }) {
  const add = useCart((s) => s.add)
  const off = discountPercent(product.price, product.compareAtPrice)
  const soldOut = product.stock <= 0

  return (
    <article
      data-ui="store/ProductCard"
      className="group relative flex h-full flex-col max-sm:rounded-2xl max-sm:border max-sm:border-border/75 max-sm:bg-card max-sm:p-2 max-sm:shadow-xs"
    >
      <div data-ui="store/ProductCard/div-relative" className="relative aspect-4/5 overflow-hidden rounded-xl bg-muted sm:rounded-2xl @container">
        <Link data-ui="store/ProductCard/Link-absolute" href={`/products/${product.slug}`} prefetch={true} className="absolute inset-0" aria-label={product.name}>
          <ProductImage
            src={product.images[0]}
            alt={product.name}
            priority={priority}
            sizes="(min-width: 1280px) 22vw, (min-width: 768px) 30vw, 50vw"
            className={`transition-transform duration-700 ease-out group-hover:scale-106 ${soldOut ? "opacity-60 grayscale" : ""}`}
          />
          <span data-ui="store/ProductCard/span-absolute" className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/25 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
        </Link>

        <div data-ui="store/ProductCard/div-flex" className="pointer-events-none absolute top-2 left-2 flex flex-col gap-1 sm:top-3 sm:left-3 sm:gap-1.5">
          {off && (
            <span data-ui="store/ProductCard/span" className="rounded-full bg-primary px-2 py-0.5 text-[0.68rem] font-semibold text-primary-foreground shadow sm:px-2.5 sm:py-1 sm:text-xs">
              {off}% off
            </span>
          )}
          {soldOut && (
            <span data-ui="store/ProductCard/span-2" className="rounded-full bg-destructive-solid px-2 py-0.5 text-[0.68rem] font-semibold text-white shadow sm:px-2.5 sm:py-1 sm:text-xs">
              Sold out
            </span>
          )}
        </div>

        <WishlistButton productId={product.id} productName={product.name} className="absolute top-2 right-2 max-sm:size-8 sm:top-3 sm:right-3" />

        {soldOut ? (
          <button data-ui="store/ProductCard/button-add-disabled"
            type="button"
            disabled
            aria-label={`${product.name} is sold out`}
            className="absolute right-2 bottom-2 grid size-8.5 cursor-not-allowed place-items-center rounded-full bg-muted text-muted-foreground shadow sm:right-3 sm:bottom-3 sm:size-10"
          >
            <PlusIcon className="size-4 sm:size-5" />
          </button>
        ) : (
          <button data-ui="store/ProductCard/button-grid"
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
            }}
            aria-label={`Add ${product.name} to cart`}
            className="absolute right-2 bottom-2 grid size-8.5 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-all duration-200 active:scale-90 hover:scale-110 focus-visible:translate-y-0 focus-visible:opacity-100 sm:right-3 sm:bottom-3 sm:size-10 md:pointer-fine:translate-y-2 md:pointer-fine:opacity-0 md:group-hover:translate-y-0 md:group-hover:opacity-100"
          >
            <PlusIcon className="size-4 sm:size-5" />
          </button>
        )}
      </div>

      <div data-ui="store/ProductCard/div-flex-2" className="mt-2 flex flex-1 flex-col gap-0.5 px-0.5 sm:mt-3 sm:gap-1">
        {product.category && (
          <span data-ui="store/ProductCard/span-3" className="truncate text-[0.65rem] font-medium tracking-wide text-muted-foreground uppercase sm:text-xs">
            {product.category.name}
          </span>
        )}
        <h3 data-ui="store/ProductCard/h3" className="font-sans text-[0.85rem] leading-snug font-semibold sm:text-[0.95rem]">
          <Link data-ui="store/ProductCard/Link" href={`/products/${product.slug}`} prefetch={true} className="line-clamp-2 hover:text-primary">
            {product.name}
          </Link>
        </h3>
        <div data-ui="store/ProductCard/div-flex-3" className="mt-auto flex items-baseline gap-1.5 pt-1 sm:gap-2">
          <span data-ui="store/ProductCard/span-4" className="text-sm font-bold sm:text-base">{formatPrice(product.price)}</span>
          {product.compareAtPrice && (
            <span data-ui="store/ProductCard/span-5" className="text-xs text-muted-foreground line-through sm:text-sm">
              {formatPrice(product.compareAtPrice)}
            </span>
          )}
        </div>
      </div>
    </article>
  )
})
