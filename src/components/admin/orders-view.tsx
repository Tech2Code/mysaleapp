import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import Link from "next/link"
import { AdminPageHeader } from "@/components/admin/admin-page-header"
import { OrdersBrowser } from "@/components/admin/order-filters"
import { OrdersTable } from "@/components/admin/orders-table"
import { buttonVariants } from "@/components/ui/button"
import type { OrderFilterCounts, OrderFilters, ReturnViewCounts } from "@/features/orders/admin-queries"
import type { Order } from "@/features/orders/types"
import { cn } from "@/lib/utils"
import styles from "./admin-orders.module.css"

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
      <AdminPageHeader eyebrow="Sales" title="Orders" description={`${total} order${total === 1 ? "" : "s"} found`} />
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
        <OrdersTable orders={orders} total={total} page={page} />

        {pages > 1 && (
          <nav className={styles.paginationNav} aria-label="Pagination">
            <Link
              href={pageHref(page - 1)}
              aria-disabled={page <= 1}
              tabIndex={page <= 1 ? -1 : undefined}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), styles.pageLink, page <= 1 && styles.pageLinkDisabled)}
            >
              <ChevronLeftIcon className={styles.iconSm} /> Previous
            </Link>
            <span className={styles.pageInfo}>
              Page {page} of {pages}
            </span>
            <Link
              href={pageHref(page + 1)}
              aria-disabled={page >= pages}
              tabIndex={page >= pages ? -1 : undefined}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), styles.pageLink, page >= pages && styles.pageLinkDisabled)}
            >
              Next <ChevronRightIcon className={styles.iconSm} />
            </Link>
          </nav>
        )}
      </OrdersBrowser>
    </>
  )
}
