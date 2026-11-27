"use client"

import { HeartIcon, ShoppingBagIcon, SparklesIcon } from "lucide-react"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Skeletonize } from "@/components/shared/skeletonize"
import { placeholderCards } from "@/features/products/placeholders"
import { isBackInStock } from "@/features/products/types"
import { useMounted } from "@/hooks/use-mounted"
import { formatPrice } from "@/lib/format"
import { cn } from "@/lib/utils"
import { useAuth } from "@/store/auth"
import { useCart } from "@/store/cart"
import { useWishlist } from "@/store/wishlist"
import styles from "./page-views.module.css"
import { ProductCard, type ProductCardData } from "./product-card"
import { ProductImage } from "./product-image"

const WISHLIST_OOS_KEY = "kk-wishlist-oos-ids"

function readSeenOosIds(): string[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(WISHLIST_OOS_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : []
  } catch {
    return []
  }
}

function writeSeenOosIds(ids: string[]) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(WISHLIST_OOS_KEY, JSON.stringify(ids.slice(-100)))
  } catch {}
}

/** `preview`: render placeholder cards as-is; loading.tsx wraps it in <Skeletonize>. Before hydration it wraps itself. */
export function WishlistView({ products, preview = false }: { products: ProductCardData[]; preview?: boolean }) {
  const mounted = useMounted()
  const ids = useWishlist((s) => s.ids)
  const add = useCart((s) => s.add)
  const { user, ready: authReady } = useAuth()
  const [clientNow, setClientNow] = useState<number | undefined>(undefined)
  const [seenOosIds, setSeenOosIds] = useState<string[]>([])

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])
  const saved = useMemo(() => ids.map((id) => byId.get(id)).filter((p): p is ProductCardData => Boolean(p)), [ids, byId])

  useEffect(() => {
    if (!mounted || preview) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate client clock & previously out-of-stock wishlist snapshot
    setClientNow(Date.now())
    const prevOos = readSeenOosIds()
    setSeenOosIds(prevOos)
    const nextOos = new Set(prevOos)
    for (const p of saved) {
      if (p.stock <= 0) nextOos.add(p.id)
    }
    writeSeenOosIds(Array.from(nextOos))
  }, [mounted, preview, saved])

  useEffect(() => {
    if (!mounted || preview || products.length === 0) return
    if (saved.length !== ids.length) {
      useWishlist.getState().replaceAll(saved.map((p) => p.id))
    }
  }, [mounted, preview, products.length, saved, ids.length])

  const backInStockItems = useMemo(() => {
    if (clientNow === undefined) return []
    const prevOosSet = new Set(seenOosIds)
    return saved.filter((p) => p.stock > 0 && (isBackInStock(p, clientNow) || prevOosSet.has(p.id)))
  }, [saved, clientNow, seenOosIds])

  const orderedSaved = useMemo(() => {
    if (backInStockItems.length === 0) return saved
    const restockedSet = new Set(backInStockItems.map((p) => p.id))
    return [...saved.filter((p) => restockedSet.has(p.id)), ...saved.filter((p) => !restockedSet.has(p.id))]
  }, [saved, backInStockItems])

  if (preview || !mounted) {
    // The saved list lives in the browser: show placeholder cards in the real grid meanwhile.
    const grid = <WishlistGrid products={placeholderCards(4)} />
    return preview ? grid : <Skeletonize>{grid}</Skeletonize>
  }

  return (
    <div className={styles.wishlistWrapper}>
      {authReady && !user && saved.length > 0 && (
        <p className={styles.deviceNotice}>
          Your wishlist is saved on this device.{" "}
          <Link href="/login?next=/wishlist" className={styles.signInLink}>
            Sign in
          </Link>{" "}
          to keep it across all your devices.
        </p>
      )}

      {backInStockItems.length > 0 && (
        <section aria-label="Back in stock wishlist alerts" className={styles.wishlistRestockBanner}>
          <div className={styles.wishlistRestockHeader}>
            <span className={styles.wishlistRestockBadge}>
              <SparklesIcon className={styles.restockIcon14} aria-hidden /> Back in stock
            </span>
            <p className={styles.wishlistRestockTitle}>
              {backInStockItems.length === 1
                ? "1 saved item is back in stock — order before it sells out!"
                : `${backInStockItems.length} saved items are back in stock — order before they sell out!`}
            </p>
          </div>
          <ul className={styles.wishlistRestockList}>
            {backInStockItems.map((p) => (
              <li key={p.id} className={styles.wishlistRestockRow}>
                <Link href={`/products/${p.slug}`} className={styles.wishlistRestockLink}>
                  <span className={styles.wishlistRestockThumb}>
                    <ProductImage src={p.images[0] ?? null} alt={p.name} sizes="44px" />
                  </span>
                  <span className={styles.wishlistRestockMeta}>
                    <span className={styles.wishlistRestockName}>{p.name}</span>
                    <span className={styles.wishlistRestockPrice}>{formatPrice(p.price)} · {p.stock} left</span>
                  </span>
                </Link>
                <Button
                  type="button"
                  size="sm"
                  onClick={() =>
                    add({
                      productId: p.id,
                      slug: p.slug,
                      name: p.name,
                      price: p.price,
                      image: p.images[0] ?? null,
                      maxQuantity: p.stock,
                    })
                  }
                  className={styles.wishlistRestockAddBtn}
                >
                  <ShoppingBagIcon className={styles.restockIcon14} /> Add to cart
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {saved.length === 0 ? (
        <div className={styles.emptyWishlistCard}>
          <div className={styles.heartCircle}>
            <HeartIcon className={styles.heartIcon} />
          </div>
          <p className={styles.emptyHeading}>Nothing saved yet</p>
          <p className={styles.emptySubtext}>Tap the heart on any product to save it here.</p>
          <Link href="/products" className={cn(buttonVariants({ size: "lg" }), styles.exploreProductsBtn)}>
            Explore products
          </Link>
        </div>
      ) : (
        <WishlistGrid products={orderedSaved} />
      )}
    </div>
  )
}

function WishlistGrid({ products }: { products: ProductCardData[] }) {
  return (
    <div className={styles.wishlistGrid}>
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  )
}
