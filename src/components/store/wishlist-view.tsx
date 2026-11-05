"use client"

import { HeartIcon } from "lucide-react"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useMounted } from "@/hooks/use-mounted"
import { cn } from "@/lib/utils"
import { useAuth } from "@/store/auth"
import { useWishlist } from "@/store/wishlist"
import { ProductCard, type ProductCardData } from "./product-card"

export function WishlistView({ products }: { products: ProductCardData[] }) {
  const mounted = useMounted()
  const ids = useWishlist((s) => s.ids)
  const user = useAuth((s) => s.user)

  if (!mounted) {
    return (
      <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="aspect-[4/5] rounded-2xl" />
        ))}
      </div>
    )
  }

  const byId = new Map(products.map((p) => [p.id, p]))
  const saved = ids.map((id) => byId.get(id)).filter((p): p is ProductCardData => Boolean(p))

  return (
    <div className="space-y-8">
      {!user && saved.length > 0 && (
        <p className="rounded-2xl bg-secondary/70 p-4 text-sm">
          Your wishlist is saved on this device.{" "}
          <Link href="/login?next=/wishlist" className="font-semibold text-primary underline-offset-4 hover:underline">
            Sign in
          </Link>{" "}
          to keep it across all your devices.
        </p>
      )}

      {saved.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-3xl border border-dashed py-20 text-center">
          <div className="grid size-20 place-items-center rounded-full bg-secondary animate-float">
            <HeartIcon className="size-8 text-rose-500" />
          </div>
          <p className="font-heading text-2xl">Nothing saved yet</p>
          <p className="text-sm text-muted-foreground">Tap the heart on any product to save it here.</p>
          <Link href="/products" className={cn(buttonVariants({ size: "lg" }), "rounded-full px-6")}>
            Explore products
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 md:grid-cols-3 xl:grid-cols-4">
          {saved.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  )
}
