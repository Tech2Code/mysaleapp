import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { AdminPageHeader } from "@/components/admin/admin-page-header"
import { OrdersBrowser } from "@/components/admin/order-filters"
import { PaymentBadge } from "@/components/shared/payment-badge"
import { StatusBadge } from "@/components/shared/status-badge"
import { buttonVariants } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ADMIN_ORDERS_PAGE_SIZE, listOrders } from "@/features/orders/admin-queries"
import { formatDateTime, formatPrice } from "@/lib/format"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Orders" }

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

export default async function AdminOrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  const sp = await searchParams
  const filters = { status: one(sp.status), payment: one(sp.payment), view: one(sp.view), q: one(sp.q), page: one(sp.page) }
  const { orders, total, page } = await listOrders(filters)
  const pages = Math.max(1, Math.ceil(total / ADMIN_ORDERS_PAGE_SIZE))

  const pageHref = (p: number) => {
    const qs = new URLSearchParams()
    if (filters.view) qs.set("view", filters.view)
    if (filters.status) qs.set("status", filters.status)
    if (filters.payment) qs.set("payment", filters.payment)
    if (filters.q) qs.set("q", filters.q)
    if (p > 1) qs.set("page", String(p))
    return `/admin/orders${qs.size ? `?${qs}` : ""}`
  }

  return (
    <>
      <AdminPageHeader title="Orders" description={`${total} order${total === 1 ? "" : "s"} found`} />
      <OrdersBrowser status={filters.status} payment={filters.payment} view={filters.view} q={filters.q}>
      <div className="overflow-hidden rounded-2xl border bg-card">
        {orders.length === 0 ? (
          <p className="p-8 sm:p-12 text-center text-sm text-muted-foreground">No orders match these filters.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead className="hidden md:table-cell">Items</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden lg:table-cell">Payment</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="hidden pr-5 text-right sm:table-cell">Placed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((o) => (
                <TableRow key={o.id} className="group">
                  <TableCell className="pl-5">
                    <Link href={`/admin/orders/${o.id}`} className="font-mono font-semibold text-primary group-hover:underline">
                      {o.orderCode}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{o.customerName}</div>
                    <div className="text-xs text-muted-foreground">
                      {o.phone} · {o.city}
                    </div>
                  </TableCell>
                  <TableCell className="hidden max-w-64 truncate text-sm text-muted-foreground md:table-cell">
                    {o.items.reduce((n, i) => n + i.quantity, 0)} × {o.items.map((i) => i.name).join(", ")}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={o.status} />
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <PaymentBadge status={o.paymentStatus} orderStatus={o.status} />
                  </TableCell>
                  <TableCell className="text-right font-semibold">{formatPrice(o.total)}</TableCell>
                  <TableCell className="hidden pr-5 text-right text-xs text-muted-foreground sm:table-cell">
                    {formatDateTime(o.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {pages > 1 && (
        <nav className="mt-4 flex items-center justify-between" aria-label="Pagination">
          <Link
            href={pageHref(page - 1)}
            aria-disabled={page <= 1}
            className={cn(buttonVariants({ variant: "outline" }), "rounded-full", page <= 1 && "pointer-events-none opacity-50")}
          >
            <ChevronLeftIcon /> Previous
          </Link>
          <span className="text-sm text-muted-foreground">
            Page {page} of {pages}
          </span>
          <Link
            href={pageHref(page + 1)}
            aria-disabled={page >= pages}
            className={cn(buttonVariants({ variant: "outline" }), "rounded-full", page >= pages && "pointer-events-none opacity-50")}
          >
            Next <ChevronRightIcon />
          </Link>
        </nav>
      )}
      </OrdersBrowser>
    </>
  )
}
