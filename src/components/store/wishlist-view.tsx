"use client"

import { HeartIcon } from "lucide-react"
import Link from "next/link"
import { useEffect, useMemo } from "react"
import { buttonVariants } from "@/components/ui/button"
import { Skeletonize } from "@/components/shared/skeletonize"
import { placeholderCards } from "@/features/products/placeholders"
import { useMounted } from "@/hooks/use-mounted"
import { cn } from "@/lib/utils"
import { useAuth } from "@/store/auth"
import { useWishlist } from "@/store/wishlist"
import styles from "./page-views.module.css"
import { ProductCard, type ProductCardData } from "./product-card"

/** `preview`: render placeholder cards as-is; loading.tsx wraps it in <Skeletonize>. Before hydration it wraps itself. */
export function WishlistView({ products, preview = false }: { products: ProductCardData[]; preview?: boolean }) {
  const mounted = useMounted()
  const ids = useWishlist((s) => s.ids)
  const { user, ready: authReady } = useAuth()

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])
  const saved = useMemo(() => ids.map((id) => byId.get(id)).filter((p): p is ProductCardData => Boolean(p)), [ids, byId])

  useEffect(() => {
    if (!mounted || preview || products.length === 0) return
    if (saved.length !== ids.length) {
      useWishlist.getState().replaceAll(saved.map((p) => p.id))
    }
  }, [mounted, preview, products.length, saved, ids.length])

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
        <WishlistGrid products={saved} />
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
