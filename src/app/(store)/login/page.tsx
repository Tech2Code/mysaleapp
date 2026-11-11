import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { LoginView } from "@/components/store/page-views"
import { getCurrentUser } from "@/features/auth/guards"
import { getStoreSettings } from "@/features/settings/queries"
import { safeNextPath } from "@/lib/safe-redirect"

export const metadata: Metadata = { title: "Sign in", robots: { index: false } }

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const user = await getCurrentUser()
  const params = await searchParams
  if (user) {
    redirect(safeNextPath(params.next, "/account/orders"))
  }

  return <LoginView shop={await getStoreSettings()} />
}
