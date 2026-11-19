import { Suspense, type ReactNode } from "react"
import { AdminAccountMenu } from "@/components/admin/admin-account-menu"
import { AdminSidebar, AdminTopbar } from "@/components/admin/admin-sidebar"
import { Skeletonize } from "@/components/shared/skeletonize"
import { getAdminPinStatus, getCurrentUser, isAdminUser, requireAdmin } from "@/features/auth/guards"
import { placeholderAdminAccount } from "@/features/auth/placeholders"
import { getPaymentsToVerifyCount } from "@/features/orders/admin-queries"
import { cleanMetaName, safeAvatarUrl } from "@/lib/supabase/config"
import { getServerSupabase } from "@/lib/supabase/server"

/**
 * Server-side gate (redirects non-admins). It renders nothing and sits NEXT to the page instead of wrapping it:
 * wrapping made the layout show its own fallback first and the page's loading.tsx only afterwards (two different
 * frames). Every admin query and action also calls requireAdmin() itself.
 */
async function AdminGate() {
  await requireAdmin()
  return null
}

/** Avatar + email of the signed-in admin, top right. */
async function AccountSlot() {
  const [user, admin] = await Promise.all([getCurrentUser(), isAdminUser()])
  if (!user || !admin) return null
  const supabase = await getServerSupabase()
  const [{ data: profile }, pinStatus] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, avatar_url")
      .eq("id", user.id)
      .maybeSingle<{ full_name: string | null; avatar_url: string | null }>(),
    getAdminPinStatus(),
  ])
  const meta = user.user_metadata as { full_name?: string; name?: string; avatar_url?: string }
  const lastSignIn = user.last_sign_in_at
    ? new Date(user.last_sign_in_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })
    : null
  return (
    <AdminAccountMenu
      account={{
        name: cleanMetaName(profile?.full_name) ?? cleanMetaName(meta.full_name) ?? cleanMetaName(meta.name) ?? user.email?.split("@")[0] ?? "Admin",
        email: user.email ?? "",
        avatarUrl: safeAvatarUrl(profile?.avatar_url) ?? safeAvatarUrl(meta.avatar_url),
        lastSignIn,
        lastSignInAt: user.last_sign_in_at ?? null,
        pinStatus,
      }}
    />
  )
}

/** Red count on the "Orders" menu item: payments waiting to be verified. */
async function OrdersBadge() {
  const [user, admin] = await Promise.all([getCurrentUser(), isAdminUser()])
  if (!user || !admin) return null
  const count = await getPaymentsToVerifyCount()
  if (count === 0) return null
  return (
    <span data-ui="layout:/admin#OrdersBadge"
      className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-primary px-1.5 text-[0.7rem] leading-none font-bold text-primary-foreground shadow-xs transition-colors group-aria-[current=page]:bg-sidebar-primary-foreground group-aria-[current=page]:text-sidebar-primary"
      title={`${count} payment${count === 1 ? "" : "s"} to verify`}
    >
      {count > 99 ? "99+" : count}
      <span data-ui="layout:/admin#OrdersBadge/span" className="sr-only"> payments to verify</span>
    </span>
  )
}

export default function AdminPanelLayout({ children }: { children: ReactNode }) {
  const badge = (
    <Suspense fallback={null}>
      <OrdersBadge />
    </Suspense>
  )

  return (
    <div data-ui="layout:/admin" className="lg:flex">
      <AdminSidebar ordersBadge={badge} />
      <div data-ui="layout:/admin/div" className="min-w-0 flex-1">
        <AdminTopbar
          ordersBadge={badge}
          account={
            <Suspense
              fallback={
                <Skeletonize>
                  <AdminAccountMenu account={placeholderAdminAccount()} />
                </Skeletonize>
              }
            >
              <AccountSlot />
            </Suspense>
          }
        />
        <main data-ui="layout:/admin/main" className="p-4 sm:p-6 lg:p-8">
          <Suspense fallback={null}>
            <AdminGate />
          </Suspense>
          {children}
        </main>
      </div>
    </div>
  )
}
