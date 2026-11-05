import { Suspense, type ReactNode } from "react"
import { AdminAccountMenu } from "@/components/admin/admin-account-menu"
import { AdminSidebar, AdminTopbar } from "@/components/admin/admin-sidebar"
import { PanelSkeleton } from "@/components/admin/panel-skeleton"
import { requireAdmin } from "@/features/auth/guards"
import { getPaymentsToVerifyCount } from "@/features/orders/admin-queries"

/** Server-side gate: every admin page is rendered only for verified admins. */
async function AdminGate({ children }: { children: ReactNode }) {
  await requireAdmin()
  return <>{children}</>
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
        avatarUrl: meta.avatar_url ?? null,
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
      className="grid min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[0.7rem] leading-5 font-bold text-primary-foreground"
      title={`${count} payment${count === 1 ? "" : "s"} to verify`}
    >
      {count > 99 ? "99+" : count}
      <span className="sr-only"> payments to verify</span>
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
      <div className="min-w-0 flex-1">
        <AdminTopbar
          ordersBadge={badge}
          account={
            <Suspense fallback={<span className="size-9 animate-pulse rounded-full bg-muted" aria-hidden />}>
              <AccountSlot />
            </Suspense>
          }
        />
        <main className="p-4 sm:p-6 lg:p-8">
          <Suspense fallback={<PanelSkeleton />}>
            <AdminGate>{children}</AdminGate>
          </Suspense>
        </main>
      </div>
    </div>
  )
}
