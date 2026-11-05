"use client"

import { useTransition } from "react"
import { toast } from "sonner"
import { setWishlisted } from "@/features/wishlist/actions"
import { useAuth } from "@/store/auth"
import { useWishlist } from "@/store/wishlist"
import { useMounted } from "./use-mounted"

/** Optimistic wishlist toggle: local for guests, synced to the DB when signed in. */
export function useWishlistToggle(productId: string, productName: string) {
  const mounted = useMounted()
  const active = useWishlist((s) => s.ids.includes(productId))
  const setOn = useWishlist((s) => s.setOn)
  const user = useAuth((s) => s.user)
  const [pending, startTransition] = useTransition()

  const toggle = () => {
    const next = !active
    setOn(productId, next)
    toast.success(next ? `Saved “${productName}” to your wishlist` : "Removed from wishlist")

    if (!user) return
    startTransition(async () => {
      const res = await setWishlisted(productId, next)
      if (!res.ok) {
        setOn(productId, !next)
        toast.error("Couldn't update your wishlist. Please try again.")
      }
    })
  }

  return { active: mounted && active, toggle, pending }
}
