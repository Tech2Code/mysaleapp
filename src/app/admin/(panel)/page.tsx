import { ArrowRightIcon, CalendarIcon, ClockIcon, IndianRupeeIcon, ShoppingBagIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { AdminPageHeader } from "@/components/admin/admin-page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { buttonVariants } from "@/components/ui/button"
import { getDashboardStats } from "@/features/orders/admin-queries"
import { ORDER_STATUSES, STATUS_META } from "@/features/orders/types"
import { formatDateTime, formatPrice } from "@/lib/format"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Dashboard" }

export default async function AdminDashboard() {
  const stats = await getDashboardStats()

  const cards = [
    { label: "Orders today", value: String(stats.today), icon: CalendarIcon, href: "/admin/orders" },
    { label: "Pending confirmation", value: String(stats.pending), icon: ClockIcon, href: "/admin/orders?status=pending", highlight: stats.pending > 0 },
    { label: "Orders (30 days)", value: String(stats.orders30d), icon: ShoppingBagIcon, href: "/admin/orders" },
    { label: "Revenue (30 days)", value: formatPrice(stats.revenue30d), icon: IndianRupeeIcon, hint: "Excludes cancelled" },
  ]
  const maxStatus = Math.max(1, ...Object.values(stats.byStatus))

  return (
    <>
      <AdminPageHeader
        title="Dashboard"
        description="A quick look at how the shop is doing."
        actions={
          <Link href="/admin/products/new" className={cn(buttonVariants(), "rounded-full px-4")}>
            Add product
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => {
          const body = (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{c.label}</span>
                <span className={cn("grid size-9 place-items-center rounded-xl", c.highlight ? "bg-primary text-primary-foreground" : "bg-secondary text-primary")}>
                  <c.icon className="size-4" />
                </span>
              </div>
              <p className="mt-3 font-heading text-3xl font-semibold">{c.value}</p>
              {c.hint && <p className="mt-1 text-xs text-muted-foreground">{c.hint}</p>}
            </>
          )
          return c.href ? (
            <Link key={c.label} href={c.href} className="rounded-2xl border bg-card p-5 transition-shadow hover:shadow-md">
              {body}
            </Link>
          ) : (
            <div key={c.label} className="rounded-2xl border bg-card p-5">
              {body}
            </div>
          )
        })}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_360px]">
        <section className="rounded-2xl border bg-card">
          <div className="flex items-center justify-between border-b p-5">
            <h2 className="font-sans text-lg font-semibold">Recent orders</h2>
            <Link href="/admin/orders" className="inline-flex items-center gap-1 text-sm font-medium text-primary">
              View all <ArrowRightIcon className="size-4" />
            </Link>
          </div>
          {stats.recent.length === 0 ? (
            <p className="p-10 text-center text-sm text-muted-foreground">
              No orders yet. Share your store link on WhatsApp and Instagram to get the first one!
            </p>
          ) : (
            <ul className="divide-y">
              {stats.recent.map((o) => (
                <li key={o.id}>
                  <Link href={`/admin/orders/${o.id}`} className="flex flex-wrap items-center gap-3 p-4 transition-colors hover:bg-muted/50">
                    <span className="font-mono text-sm font-semibold">{o.orderCode}</span>
                    <span className="flex-1 truncate text-sm">{o.customerName}</span>
                    <StatusBadge status={o.status} />
                    <span className="w-20 text-right text-sm font-semibold">{formatPrice(o.subtotal)}</span>
                    <span className="w-28 text-right text-xs text-muted-foreground">{formatDateTime(o.createdAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border bg-card p-5">
          <h2 className="font-sans text-lg font-semibold">Last 30 days by status</h2>
          <ul className="mt-5 space-y-3">
            {ORDER_STATUSES.map((s) => (
              <li key={s}>
                <Link href={`/admin/orders?status=${s}`} className="group block">
                  <div className="flex justify-between text-sm">
                    <span className="group-hover:text-primary">{STATUS_META[s].label}</span>
                    <span className="font-semibold tabular-nums">{stats.byStatus[s]}</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary/80"
                      style={{ width: `${(stats.byStatus[s] / maxStatus) * 100}%` }}
                    />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  )
}
