"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Suspense, useEffect } from "react"
import { toast } from "sonner"
import { getMyProfile } from "@/features/account/actions"
import { getMyReviewEligibilitySnapshot } from "@/features/products/actions"
import { syncWishlist } from "@/features/wishlist/actions"
import { clearUserReviewStateCache, primeUserReviewStateCache } from "@/components/store/product-actions"
import { getBrowserSupabase } from "@/lib/supabase/client"
import { cleanMetaName, safeAvatarUrl } from "@/lib/supabase/config"
import { readCachedAuthSnapshot, useAuth, type SessionUser } from "@/store/auth"
import { useCart } from "@/store/cart"
import { useWishlist } from "@/store/wishlist"
import type { User } from "@supabase/supabase-js"

let lastSyncedUserId: string | null = null
let explicitSignOutUntil = 0
const profileOverrides = new Map<string, { name?: string; email?: string; avatarUrl?: string | null }>()

function clearOrderSession() {
  try {
    sessionStorage.removeItem("kk-last-order")
    sessionStorage.removeItem("kk-checkout-draft")
  } catch {}
}

function toSessionUser(user: User): SessionUser {
  const meta = user.user_metadata ?? {}
  const override = profileOverrides.get(user.id)
  return {
    id: user.id,
    email: override?.email || user.email || "",
    name: override?.name || cleanMetaName(meta.full_name) || cleanMetaName(meta.name) || user.email?.split("@")[0] || "You",
    avatarUrl: override?.avatarUrl !== undefined ? override.avatarUrl : safeAvatarUrl(meta.avatar_url),
  }
}

/**
 * Updates the authoritative customer profile fields in `useAuth` and prevents stale
 * JWT `user_metadata` from overwriting them on subsequent route checks.
 */
export function applyClientProfileUpdate(patch: { name?: string; email?: string; avatarUrl?: string | null }) {
  const current = useAuth.getState().user
  if (!current) return
  const prev = profileOverrides.get(current.id) ?? {}
  const nextOverride = {
    name: patch.name?.trim() || prev.name,
    email: patch.email?.trim() || prev.email,
    avatarUrl: patch.avatarUrl !== undefined ? patch.avatarUrl : prev.avatarUrl,
  }
  profileOverrides.set(current.id, nextOverride)
  useAuth.getState().setUser({
    ...current,
    name: nextOverride.name || current.name,
    email: nextOverride.email || current.email,
    avatarUrl: nextOverride.avatarUrl !== undefined ? nextOverride.avatarUrl : current.avatarUrl,
  })
}

function runBackgroundAccountSync(userId: string, skipWishlist = false) {
  const { ids: storedIds, ownerId } = useWishlist.getState()
  // Only merge local items when they belonged to a guest (`null`) or the same account — never another user.
  const localIds = ownerId === null || ownerId === userId ? storedIds : []
  if (!skipWishlist) {
    if (ownerId !== null && ownerId !== userId) {
      useWishlist.getState().replaceAll([], userId)
      clearOrderSession()
    } else {
      useWishlist.getState().setOwner(userId)
    }
  }
  const snapshot = new Set(localIds)
  setTimeout(async () => {
    const [wishRes, profile, reviewSnapshot] = await Promise.all([
      skipWishlist ? Promise.resolve(null) : syncWishlist(localIds),
      getMyProfile({ consumeReactivated: true }).catch(() => null),
      getMyReviewEligibilitySnapshot().catch(() => null),
    ])
    if (useAuth.getState().user?.id !== userId) return
    if (reviewSnapshot) {
      primeUserReviewStateCache(userId, reviewSnapshot)
    }
    if (profile) {
      applyClientProfileUpdate({
        name: profile.fullName || undefined,
        email: profile.email || undefined,
        avatarUrl: profile.avatarUrl ?? undefined,
      })
      if (profile.reactivated) {
        toast.success("Welcome back! Your deactivated account has been restored.")
      }
    }
    if (wishRes && wishRes.ok) {
      lastSyncedUserId = userId
      const nowIds = useWishlist.getState().ids
      const addedDuringSync = nowIds.filter((id) => !snapshot.has(id))
      const removedDuringSync = [...snapshot].filter((id) => !nowIds.includes(id))
      const merged = [...addedDuringSync, ...wishRes.data.filter((id) => !removedDuringSync.includes(id))]
      useWishlist.getState().replaceAll(merged, userId)
    } else if (!skipWishlist && lastSyncedUserId === userId) {
      lastSyncedUserId = null
    }
  }, 0)
}

/**
 * Immediately applies a signed-in user and their merged wishlist to client stores
 * (used right after signInCustomer / signUpCustomer / signInAdmin Server Actions).
 */
export function applyClientSignIn(user: SessionUser, wishlistIds?: string[]) {
  const prevOwnerId = useWishlist.getState().ownerId
  if (prevOwnerId !== null && prevOwnerId !== user.id) {
    clearOrderSession()
  }
  lastSyncedUserId = user.id
  profileOverrides.set(user.id, { name: user.name, email: user.email, avatarUrl: user.avatarUrl })
  useAuth.getState().setUser(user)
  if (wishlistIds) {
    useWishlist.getState().replaceAll(wishlistIds, user.id)
  } else {
    runBackgroundAccountSync(user.id)
  }
}

/**
 * Immediately clears client auth and account-bound wishlist state on sign-out.
 */
export function applyClientSignOut() {
  explicitSignOutUntil = Date.now() + 5000
  lastSyncedUserId = null
  profileOverrides.clear()
  clearUserReviewStateCache()
  useAuth.getState().setUser(null)
  useWishlist.getState().clear()
  clearOrderSession()
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem("kk-wishlist-oos-ids")
      window.localStorage.removeItem("kk-stock-alerts")
    } catch {
      // ignore storage errors
    }
  }
}

function handleSessionChange(user: User | null, isSignedOutEvent = false) {
  const currentUser = useAuth.getState().user
  if (!user) {
    useAuth.getState().setUser(null)
    clearUserReviewStateCache()
    if (isSignedOutEvent || currentUser !== null || useWishlist.getState().ownerId !== null) {
      lastSyncedUserId = null
      profileOverrides.clear()
      useWishlist.getState().clear()
      clearOrderSession()
      if (
        typeof window !== "undefined" &&
        Date.now() >= explicitSignOutUntil &&
        (isSignedOutEvent || currentUser !== null)
      ) {
        const p = window.location.pathname
        if (p === "/account" || p.startsWith("/account/")) {
          window.location.replace(`/login?next=${encodeURIComponent(p)}`)
        } else if (
          (p === "/admin" || p.startsWith("/admin/")) &&
          !p.startsWith("/admin/login") &&
          !p.startsWith("/admin/forgot-password") &&
          !p.startsWith("/admin/reset-password")
        ) {
          window.location.replace("/admin/login")
        }
      }
    }
    return
  }

  const nextUser = toSessionUser(user)
  useAuth.getState().setUser(nextUser)

  if (user.id !== lastSyncedUserId) {
    lastSyncedUserId = user.id
    runBackgroundAccountSync(user.id)
  }
}

/**
 * Reads the current browser cookie session and updates `useAuth` + `useWishlist`.
 * Needed after Server Actions or route redirects that mutate auth cookies via HTTP Set-Cookie.
 */
export async function syncAuthSession() {
  const supabase = getBrowserSupabase()
  if (!supabase) {
    useAuth.getState().setUser(null)
    return
  }
  const { data } = await supabase.auth.getSession()
  handleSessionChange(data.session?.user ?? null)
}

function AuthRouteSync() {
  const router = useRouter()
  const pathname = usePathname()
  const search = useSearchParams().toString()

  useEffect(() => {
    if (typeof window !== "undefined") {
      const searchParams = new URLSearchParams(window.location.search)
      const hashRaw = window.location.hash.replace(/^#/, "")
      const hashParams = new URLSearchParams(hashRaw)

      // 1. If Supabase landed on the Site URL root with ?code=... or ?token_hash=..., forward to /auth/callback
      // (Never intercept /order-placed?code=... or /track?code=... where `code` is an order code!)
      if (
        pathname === "/" &&
        (searchParams.has("code") || searchParams.has("token_hash"))
      ) {
        window.location.replace(`/auth/callback${window.location.search}`)
        return
      }

      // 2. If Supabase attached #error=... or ?error_code=... onto a non-login page (e.g. /?error=access_denied&error_code=otp_expired#error=...)
      const errCode = searchParams.get("error_code") || hashParams.get("error_code")
      const errDesc = (
        searchParams.get("error_description") ||
        hashParams.get("error_description") ||
        ""
      ).toLowerCase()
      const rawErr = searchParams.get("error") || hashParams.get("error")

      if (
        pathname !== "/login" &&
        pathname !== "/admin/forgot-password" &&
        pathname !== "/admin/login" &&
        pathname !== "/admin/account" &&
        pathname !== "/account/profile" &&
        (errCode || errDesc || (rawErr && hashParams.has("error")))
      ) {
        const isExpired =
          errCode === "otp_expired" ||
          errDesc.includes("expired") ||
          errDesc.includes("invalid")
        // Clean the current history entry first so Back doesn't show raw query/hash errors
        window.history.replaceState(null, "", pathname)
        if (pathname?.startsWith("/admin")) {
          router.replace(isExpired ? "/admin/forgot-password?error=expired" : "/admin/login")
        } else {
          router.replace(isExpired ? "/login?mode=forgot&error=expired" : "/login?error=auth")
        }
        return
      }
    }

    void syncAuthSession()
  }, [pathname, router, search])

  return null
}

/**
 * Keeps the client-side auth store in sync with Supabase and merges the
 * guest wishlist into the account when a user signs in.
 */
export function AuthListener() {
  const router = useRouter()
  const setUser = useAuth((s) => s.setUser)

  useEffect(() => {
    if (!useAuth.getState().ready) {
      const cached = readCachedAuthSnapshot()
      if (cached.known) {
        setUser(cached.user)
      }
    }

    const supabase = getBrowserSupabase()
    if (!supabase) {
      setUser(null)
      return
    }

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      handleSessionChange(session?.user ?? null, event === "SIGNED_OUT")
      if (event === "PASSWORD_RECOVERY" && typeof window !== "undefined") {
        const currentPath = window.location.pathname
        if (currentPath !== "/login" && currentPath !== "/admin/reset-password") {
          window.history.replaceState(null, "", currentPath)
          router.replace("/login?mode=reset-password")
        }
      }
    })

    const onStorage = (e: StorageEvent) => {
      if (e.key === "kk-cart") void useCart.persist.rehydrate()
      if (e.key === "kk-wishlist") void useWishlist.persist.rehydrate()
      if (e.key === "kk-auth") void syncAuthSession()
    }
    const onFocus = () => {
      void syncAuthSession()
    }

    window.addEventListener("storage", onStorage)
    window.addEventListener("focus", onFocus)

    return () => {
      data.subscription.unsubscribe()
      window.removeEventListener("storage", onStorage)
      window.removeEventListener("focus", onFocus)
    }
  }, [router, setUser])

  return (
    <Suspense fallback={null}>
      <AuthRouteSync />
    </Suspense>
  )
}
