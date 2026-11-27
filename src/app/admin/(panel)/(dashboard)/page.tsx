import type { Metadata } from "next"
import { connection } from "next/server"
import styles from "@/components/admin/admin-core.module.css"
import { DashboardView } from "@/components/admin/dashboard/dashboard-view"
import { isAdminPinLocked, requireAdmin } from "@/features/auth/guards"
import { getDashboard } from "@/features/orders/admin-queries"
import { istDayKey, resolveRange } from "@/features/orders/dashboard-range"
import { firstParam } from "@/lib/validation"

export const metadata: Metadata = { title: "Dashboard" }

const one = firstParam

export default async function AdminDashboard({ searchParams }: PageProps<"/admin">) {
  await requireAdmin({ allowWhenPinLocked: true })
  if (await isAdminPinLocked()) {
    return (
      <div className={styles.pinLockedPlaceholder} aria-live="polite">
        Admin screen is locked. Enter your 4-digit PIN in the prompt to view this page.
      </div>
    )
  }
  const sp = await searchParams
  await connection() // the date range depends on "today", so this page is rendered per request
  const now = new Date()
  const range = resolveRange({ range: one(sp.range), month: one(sp.month), fy: one(sp.fy), from: one(sp.from), to: one(sp.to) }, now)
  const d = await getDashboard(range)

  return <DashboardView d={d} range={range} today={istDayKey(now)} />
}
