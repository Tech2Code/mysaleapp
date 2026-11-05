"use client"

import { useEffect } from "react"
import { syncWishlist } from "@/features/wishlist/actions"
import { getBrowserSupabase } from "@/lib/supabase/client"
import { useAuth, type SessionUser } from "@/store/auth"
import { useWishlist } from "@/store/wishlist"
import type { User } from "@supabase/supabase-js"

function toSessionUser(user: User): SessionUser {
  const meta = user.user_metadata ?? {}
  return {
    id: user.id,
    email: user.email ?? "",
    name: (meta.full_name as string) || (meta.name as string) || user.email?.split("@")[0] || "You",
    avatarUrl: (meta.avatar_url as string) || null,
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

      if (event === "SIGNED_OUT") {
        lastSyncedUserId = null
        useWishlist.getState().clear()
        return
      }

      if (user && user.id !== lastSyncedUserId) {
        lastSyncedUserId = user.id
        const localIds = useWishlist.getState().ids
        // Defer: Supabase recommends not awaiting other calls inside this callback.
        setTimeout(async () => {
          const res = await syncWishlist(localIds)
          if (res.ok) useWishlist.getState().replaceAll(res.data)
        }, 0)
      }
    })

    return () => data.subscription.unsubscribe()
  }, [setUser])

  return null
}
