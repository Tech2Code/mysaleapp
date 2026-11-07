import type { Metadata } from "next"
import { connection } from "next/server"
import { DashboardView } from "@/components/admin/dashboard/dashboard-view"
import { getDashboard } from "@/features/orders/admin-queries"
import { istDayKey, resolveRange } from "@/features/orders/dashboard-range"


import { firstParam } from "@/lib/validation"

export const metadata: Metadata = { title: "Dashboard" }

const one = firstParam

export default async function AdminDashboard({ searchParams }: PageProps<"/admin">) {
  const sp = await searchParams
  await connection() // the date range depends on "today", so this page is rendered per request
  const now = new Date()
  const range = resolveRange({ range: one(sp.range), month: one(sp.month), fy: one(sp.fy), from: one(sp.from), to: one(sp.to) }, now)
  const d = await getDashboard(range)

  return <DashboardView d={d} range={range} today={istDayKey(now)} />
}
