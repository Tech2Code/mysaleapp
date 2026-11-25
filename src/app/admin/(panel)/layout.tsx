import { Suspense, type ReactNode } from "react"
import { AdminAccountMenu } from "@/components/admin/admin-account-menu"
import styles from "@/components/admin/admin-core.module.css"
import { AdminMobileBottomNav, AdminSidebar, AdminTopbar } from "@/components/admin/admin-sidebar"
import { Skeletonize } from "@/components/shared/skeletonize"
import { getAdminPinStatus, getCurrentUser, isAdminPinLocked, isAdminUser, requireAdmin } from "@/features/auth/guards"
import { placeholderAdminAccount } from "@/features/auth/placeholders"
import { getPaymentsToVerifyCount } from "@/features/orders/admin-queries"
import { cleanMetaName, safeAvatarUrl } from "@/lib/supabase/config"
import { getServerSupabase } from "@/lib/supabase/server"

/**
 * Server-side gate (redirects non-admins). It renders nothing and sits NEXT to the page instead of wrapping it:
 * wrapping made the layout show its own fallback first and the page's loading.tsx only afterwards (two different
 * frames). Every admin query and action also calls requireAdmin() itself.
 */
async function AdminGate({ children }: { children: ReactNode }) {
  await requireAdmin({ allowWhenPinLocked: true })
  if (await isAdminPinLocked()) {
    return (
      <div className={styles.pinLockedPlaceholder} aria-live="polite">
        Admin screen is locked. Enter your 4-digit PIN in the prompt to view this page.
      </div>
    )
  }
  return <>{children}</>
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
  const [user, admin, pinLocked] = await Promise.all([getCurrentUser(), isAdminUser(), isAdminPinLocked()])
  if (!user || !admin || pinLocked) return null
  const count = await getPaymentsToVerifyCount()
  if (count === 0) return null
  return (
    <span
      className={styles.ordersBadge}
      title={`${count} payment${count === 1 ? "" : "s"} to verify`}
    >
      {count > 99 ? "99+" : count}
      <span className={styles.srOnly}> payments to verify</span>
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
    <div className={styles.adminPanelLayout}>
      <AdminSidebar ordersBadge={badge} />
      <div className={styles.adminPanelMainCol}>
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
        <main data-slot="admin-main" className={styles.adminMainContent}>
          <Suspense fallback={null}>
            <AdminGate>{children}</AdminGate>
          </Suspense>
        </main>
      </div>
      <AdminMobileBottomNav ordersBadge={badge} />
    </div>
  )
}
