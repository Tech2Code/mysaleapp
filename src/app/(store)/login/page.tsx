import type { Metadata } from "next"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { LoginView } from "@/components/store/page-views"
import { getCurrentUser, hasValidPasswordResetCookie } from "@/features/auth/guards"
import { getStoreSettings } from "@/features/settings/queries"
import { safeNextPath } from "@/lib/safe-redirect"

export const metadata: Metadata = { title: "Sign in", robots: { index: false } }

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; mode?: string }>
}) {
  const [user, cookieStore, params] = await Promise.all([
    getCurrentUser(),
    cookies(),
    searchParams,
  ])
  const hasValidResetCookie = Boolean(
    user &&
      hasValidPasswordResetCookie(
        cookieStore.get("kk_cust_pw_reset")?.value,
        "customer",
        user.id
      )
  )
  if (params.mode === "reset-password" && !hasValidResetCookie) {
    redirect("/login?mode=forgot&error=expired")
  }
  if (user && hasValidResetCookie && params.mode !== "reset-password") {
    redirect("/login?mode=reset-password")
  }
  if (user && params.mode !== "reset-password") {
    redirect(safeNextPath(params.next, "/"))
  }

  return <LoginView shop={await getStoreSettings()} />
}
