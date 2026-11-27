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
    if (pending) return
    const next = !active
    const toastId = `wishlist-${productId}`
    setOn(productId, next)
    toast.success(next ? `Saved “${productName}” to your wishlist` : "Removed from wishlist", { id: toastId })

    if (!user) return
    const actingUserId = user.id
    startTransition(async () => {
      try {
        const res = await setWishlisted(productId, next)
        if (!res.ok) {
          if (useAuth.getState().user?.id === actingUserId) {
            setOn(productId, !next)
          }
          toast.error("Couldn't update your wishlist. Please try again.", { id: toastId })
        }
      } catch {
        if (useAuth.getState().user?.id === actingUserId) {
          setOn(productId, !next)
        }
        toast.error("Couldn't update your wishlist. Please try again.", { id: toastId })
      }
    })
  }

  return { active: mounted && active, toggle, pending }
}
