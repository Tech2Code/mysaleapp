import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import Link from "next/link"
import { AdminPageHeader } from "@/components/admin/admin-page-header"
import { OrdersBrowser } from "@/components/admin/order-filters"
import { OrdersTable } from "@/components/admin/orders-table"
import { buttonVariants } from "@/components/ui/button"
import type { OrderFilterCounts, OrderFilters, ReturnViewCounts } from "@/features/orders/admin-queries"
import type { Order } from "@/features/orders/types"
import { cn } from "@/lib/utils"

/** The admin orders page. The page passes real data; loading.tsx passes placeholders inside <Skeletonize>. */
export function OrdersView({
  orders,
  total,
  page,
  pages,
  filters,
  returnCounts,
  filterCounts,
}: {
  orders: Order[]
  total: number
  page: number
  pages: number
  filters: OrderFilters
  /** Orders per return chip (from the same filters as the lists). Omitted in the loading skeleton. */
  returnCounts?: ReturnViewCounts
  filterCounts?: OrderFilterCounts
}) {
  const pageHref = (p: number) => {
    const qs = new URLSearchParams()
    if (filters.view) qs.set("view", filters.view)
    if (filters.status) qs.set("status", filters.status)
    if (filters.payment) qs.set("payment", filters.payment)
    if (filters.q) qs.set("q", filters.q)
    if (filters.year) qs.set("year", filters.year)
    if (filters.month) qs.set("month", filters.month)
    if (p > 1) qs.set("page", String(p))
    return `/admin/orders${qs.size ? `?${qs}` : ""}`
  }

  return (
    <>
      <AdminPageHeader title="Orders" description={`${total} order${total === 1 ? "" : "s"} found`} />
      <OrdersBrowser
        status={filters.status}
        payment={filters.payment}
        view={filters.view}
        q={filters.q}
        year={filters.year}
        month={filters.month}
        today={filters.today}
        returnCounts={returnCounts ?? filterCounts?.returns}
        filterCounts={filterCounts}
      >
        <OrdersTable orders={orders} />

        {pages > 1 && (
          <nav data-ui="admin/OrdersView/nav-pagination" className="mt-4 flex items-center justify-between" aria-label="Pagination">
            <Link data-ui="admin/OrdersView/Link-previous"
              href={pageHref(page - 1)}
              aria-disabled={page <= 1}
              tabIndex={page <= 1 ? -1 : undefined}
              className={cn(buttonVariants({ variant: "outline" }), "rounded-full", page <= 1 && "pointer-events-none opacity-50")}
            >
              <ChevronLeftIcon /> Previous
            </Link>
            <span data-ui="admin/OrdersView/span" className="text-sm text-muted-foreground">
              Page {page} of {pages}
            </span>
            <Link data-ui="admin/OrdersView/Link-next"
              href={pageHref(page + 1)}
              aria-disabled={page >= pages}
              tabIndex={page >= pages ? -1 : undefined}
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
