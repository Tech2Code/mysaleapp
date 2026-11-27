"use client"

import { PlusIcon, SparklesIcon, StarIcon } from "lucide-react"
import Link from "next/link"
import { memo, useEffect, useState } from "react"
import { isBackInStock, type ProductCardData } from "@/features/products/types"
import { discountPercent, formatPrice, formatRating } from "@/lib/format"
import { cn } from "@/lib/utils"
import { useCart } from "@/store/cart"
import styles from "./product-card.module.css"
import { ProductImage } from "./product-image"
import { WishlistButton } from "./wishlist-button"

export type { ProductCardData }

export const ProductCard = memo(function ProductCard({ product, priority }: { product: ProductCardData; priority?: boolean }) {
  const add = useCart((s) => s.add)
  const [clientNow, setClientNow] = useState<number | undefined>(undefined)
  useEffect(() => {
    setClientNow(Date.now())
  }, [])
  const off = discountPercent(product.price, product.compareAtPrice)
  const soldOut = product.stock <= 0
  const variants = product.variants ?? []
  const hasVariants = variants.length > 0
  const hasPriceRange = hasVariants && new Set(variants.map((v) => v.price)).size > 1
  const backInStock = !soldOut && clientNow !== undefined && isBackInStock(product, clientNow)
  const reviewCount = product.reviewCount ?? 0
  const ratingAvg = Number(product.ratingAvg ?? 0)
  const hasRating = reviewCount > 0 && ratingAvg > 0
  const ratingLabel = `Rated ${formatRating(ratingAvg)} out of 5 from ${reviewCount} ${reviewCount === 1 ? "review" : "reviews"}`

  return (
    <article

      className={styles.productCard}
    >
      <div className={styles.mediaFrame}>
        <Link href={`/products/${product.slug}`} prefetch={true} className={styles.imageLink} aria-label={product.name}>
          <ProductImage
            src={product.images[0]}
            alt={product.name}
            priority={priority}
            sizes="(min-width: 1280px) 22vw, (min-width: 768px) 30vw, 50vw"
            className={cn(styles.productPhoto, soldOut && styles.productPhotoSoldOut)}
          />
          <span className={styles.hoverVignette} />
        </Link>

        <div className={styles.badgeStack}>
          {off && (
            <span className={styles.discountBadge}>
              {off}% off
            </span>
          )}
          {soldOut && (
            <span className={styles.soldOutBadge}>
              Sold out
            </span>
          )}
          {backInStock && (
            <span className={styles.backInStockBadge}>
              <SparklesIcon className={styles.backInStockSvg} aria-hidden /> Back in stock
            </span>
          )}
        </div>

        {hasRating && (
          <div

            className={styles.ratingPill}
            aria-label={ratingLabel}
          >
            <span>{formatRating(ratingAvg)}</span>
            <StarIcon className={styles.pillStar} aria-hidden />
            <span className={styles.pillDivider} aria-hidden>|</span>
            <span className={styles.pillCount}>{reviewCount}</span>
          </div>
        )}

        <WishlistButton productId={product.id} productName={product.name} className={styles.cardWishlistPos} />

        {soldOut ? (
          <button
            type="button"
            disabled
            aria-label={`${product.name} is sold out`}
            className={styles.quickAddDisabled}
          >
            <PlusIcon className={styles.plusIcon} />
          </button>
        ) : hasVariants ? (
          <Link
            href={`/products/${product.slug}`}
            prefetch={true}
            aria-label={`Select options for ${product.name}`}
            className={styles.quickAddBtn}
          >
            <PlusIcon className={styles.plusIcon} />
          </Link>
        ) : (
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
            }}
            aria-label={`Add ${product.name} to cart`}
            className={styles.quickAddBtn}
          >
            <PlusIcon className={styles.plusIcon} />
          </button>
        )}
      </div>

      <div className={styles.cardBody}>
        {product.category && (
          <span className={styles.categoryName}>
            {product.category.name}
          </span>
        )}
        <h3 className={styles.productTitle}>
          <Link href={`/products/${product.slug}`} prefetch={true} className={styles.titleLink}>
            {product.name}
          </Link>
        </h3>
        <div className={styles.priceRow}>
          <span className={styles.currentPrice}>
            {hasPriceRange ? `From ${formatPrice(product.price)}` : formatPrice(product.price)}
          </span>
          {product.compareAtPrice && (
            <span className={styles.comparePrice}>
              {formatPrice(product.compareAtPrice)}
            </span>
          )}
        </div>
      </div>
    </article>
  )
})
