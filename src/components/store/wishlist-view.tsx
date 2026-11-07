"use client"

import { HeartIcon } from "lucide-react"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { Skeletonize } from "@/components/shared/skeletonize"
import { placeholderCards } from "@/features/products/placeholders"
import { useMounted } from "@/hooks/use-mounted"
import { cn } from "@/lib/utils"
import { useAuth } from "@/store/auth"
import { useWishlist } from "@/store/wishlist"
import { ProductCard, type ProductCardData } from "./product-card"

/** `preview`: render placeholder cards as-is; loading.tsx wraps it in <Skeletonize>. Before hydration it wraps itself. */
export function WishlistView({ products, preview = false }: { products: ProductCardData[]; preview?: boolean }) {
  const mounted = useMounted()
  const ids = useWishlist((s) => s.ids)
  const user = useAuth((s) => s.user)

  if (preview || !mounted) {
    // The saved list lives in the browser: show placeholder cards in the real grid meanwhile.
    const grid = <WishlistGrid products={placeholderCards(4)} />
    return preview ? grid : <Skeletonize>{grid}</Skeletonize>
  }

  const byId = new Map(products.map((p) => [p.id, p]))
  const saved = ids.map((id) => byId.get(id)).filter((p): p is ProductCardData => Boolean(p))

  return (
    <div data-ui="store/WishlistView" className="space-y-8">
      {!user && saved.length > 0 && (
        <p data-ui="store/WishlistView/p" className="rounded-2xl bg-secondary/70 p-4 text-sm">
          Your wishlist is saved on this device.{" "}
          <Link data-ui="store/WishlistView/Link-sign-in" href="/login?next=/wishlist" className="font-semibold text-primary underline-offset-4 hover:underline">
            Sign in
          </Link>{" "}
          to keep it across all your devices.
        </p>
      )}

      {saved.length === 0 ? (
        <div data-ui="store/WishlistView/div-flex" className="flex flex-col items-center gap-4 rounded-3xl border border-dashed py-14 sm:py-20 text-center">
          <div data-ui="store/WishlistView/div-grid" className="grid size-20 place-items-center rounded-full bg-secondary animate-float">
            <HeartIcon className="size-8 text-rose-500" />
          </div>
          <p data-ui="store/WishlistView/p-2" className="font-heading text-2xl">Nothing saved yet</p>
          <p data-ui="store/WishlistView/p-3" className="text-sm text-muted-foreground">Tap the heart on any product to save it here.</p>
          <Link data-ui="store/WishlistView/Link-explore-products" href="/products" className={cn(buttonVariants({ size: "lg" }), "rounded-full px-6")}>
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
    <div data-ui="store/WishlistGrid" className="grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 md:grid-cols-3 xl:grid-cols-4">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  )
}
