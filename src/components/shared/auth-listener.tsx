"use client"

import { useEffect } from "react"
import { syncWishlist } from "@/features/wishlist/actions"
import { getBrowserSupabase } from "@/lib/supabase/client"
import { safeAvatarUrl } from "@/lib/supabase/config"
import { useAuth, type SessionUser } from "@/store/auth"
import { useWishlist } from "@/store/wishlist"
import type { User } from "@supabase/supabase-js"

function clearOrderSession() {
  try {
    sessionStorage.removeItem("kk-last-order")
  } catch {}
}

function toSessionUser(user: User): SessionUser {
  const meta = user.user_metadata ?? {}
  return {
    id: user.id,
    email: user.email ?? "",
    name: (meta.full_name as string) || (meta.name as string) || user.email?.split("@")[0] || "You",
    avatarUrl: safeAvatarUrl(meta.avatar_url),
  }
}

/**
 * Keeps the client-side auth store in sync with Supabase and merges the
 * guest wishlist into the account when a user signs in.
 */
export function AuthListener() {
  const setUser = useAuth((s) => s.setUser)

  useEffect(() => {
    const supabase = getBrowserSupabase()
    if (!supabase) {
      setUser(null)
      return
    }

    let lastSyncedUserId: string | null = null

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      const user = session?.user ?? null
      setUser(user ? toSessionUser(user) : null)

      if (event === "SIGNED_OUT" || (!user && useWishlist.getState().ownerId !== null)) {
        lastSyncedUserId = null
        useWishlist.getState().clear()
        clearOrderSession()
        return
      }

      if (user && user.id !== lastSyncedUserId) {
        lastSyncedUserId = user.id
        const { ids: storedIds, ownerId } = useWishlist.getState()
        // Only merge local items when they belonged to a guest (`null`) or the same account — never another user.
        const localIds = ownerId === null || ownerId === user.id ? storedIds : []
        if (ownerId !== null && ownerId !== user.id) {
          useWishlist.getState().replaceAll([], user.id)
          clearOrderSession()
        } else {
          useWishlist.getState().setOwner(user.id)
        }
        const snapshot = new Set(localIds)
        // Defer: Supabase recommends not awaiting other calls inside this callback.
        setTimeout(async () => {
          const res = await syncWishlist(localIds)
          if (!res.ok || useAuth.getState().user?.id !== user.id) return
          const nowIds = useWishlist.getState().ids
          const addedDuringSync = nowIds.filter((id) => !snapshot.has(id))
          const removedDuringSync = [...snapshot].filter((id) => !nowIds.includes(id))
          const merged = [...addedDuringSync, ...res.data.filter((id) => !removedDuringSync.includes(id))]
          useWishlist.getState().replaceAll(merged, user.id)
        }, 0)
      }
    })

    return () => data.subscription.unsubscribe()
  }, [setUser])

  return null
}
