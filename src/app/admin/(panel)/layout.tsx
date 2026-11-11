import { Suspense, type ReactNode } from "react"
import { AdminAccountMenu } from "@/components/admin/admin-account-menu"
import { AdminSidebar, AdminTopbar } from "@/components/admin/admin-sidebar"
import { Skeletonize } from "@/components/shared/skeletonize"
import { requireAdmin } from "@/features/auth/guards"
import { placeholderAdminAccount } from "@/features/auth/placeholders"
import { getPaymentsToVerifyCount } from "@/features/orders/admin-queries"
import { safeAvatarUrl } from "@/lib/supabase/config"

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
  const user = await requireAdmin()
  const meta = user.user_metadata as { full_name?: string; name?: string; avatar_url?: string }
  const lastSignIn = user.last_sign_in_at
    ? new Date(user.last_sign_in_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })
    : null
  return (
    <AdminAccountMenu
      account={{
        name: meta.full_name ?? meta.name ?? user.email?.split("@")[0] ?? "Admin",
        email: user.email ?? "",
        avatarUrl: safeAvatarUrl(meta.avatar_url),
        lastSignIn,
      }}
    />
  )
}

/** Red count on the "Orders" menu item: payments waiting to be verified. */
async function OrdersBadge() {
  const count = await getPaymentsToVerifyCount()
  if (count === 0) return null
  return (
    <span data-ui="layout:/admin#OrdersBadge"
      className="grid min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[0.7rem]/5  font-bold text-primary-foreground"
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
