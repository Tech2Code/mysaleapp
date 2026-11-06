import { ChevronRightIcon, PackageIcon } from "lucide-react"
import Link from "next/link"
import { Suspense } from "react"
import { StatusBadge } from "@/components/shared/status-badge"
import { buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { describeHours, formatDeadline, paymentDeadline } from "@/features/orders/deadline"
import { getMyOrders } from "@/features/orders/queries"
import { isAwaitingPayment } from "@/features/orders/types"
import { getStoreSettings } from "@/features/settings/queries"
import { formatDate, formatPrice } from "@/lib/format"
import { cn } from "@/lib/utils"

async function OrdersList() {
  const [orders, shop] = await Promise.all([getMyOrders(), getStoreSettings()])

  if (orders.length === 0) {
    return (
      <div data-ui="page:/account/orders#OrdersList" className="flex flex-col items-center gap-4 rounded-3xl border border-dashed py-14 sm:py-20 text-center">
        <PackageIcon className="size-10 text-muted-foreground" />
        <p data-ui="page:/account/orders#OrdersList/p" className="font-heading text-2xl">No orders yet</p>
        <p data-ui="page:/account/orders#OrdersList/p-2" className="max-w-sm text-sm text-muted-foreground">
          Orders you place while signed in appear here. Guest orders can be tracked with their order code.
        </p>
        <div data-ui="page:/account/orders#OrdersList/div-flex" className="flex gap-3">
          <Link data-ui="page:/account/orders#OrdersList/Link-start-shopping" href="/products" className={cn(buttonVariants(), "rounded-full px-5")}>
            Start shopping
          </Link>
          <Link data-ui="page:/account/orders#OrdersList/Link-track-a-guest-order" href="/track" className={cn(buttonVariants({ variant: "outline" }), "rounded-full px-5")}>
            Track a guest order
          </Link>
        </div>
      </div>
    )
  }

  return (
    <ul data-ui="page:/account/orders#OrdersList" className="space-y-3">
      {orders.map((o) => (
        <li data-ui="page:/account/orders#OrdersList/li" key={o.id}>
          <Link data-ui="page:/account/orders#OrdersList/Link-flex"
            href={`/account/orders/${o.orderCode}`}
            className="group flex items-center gap-4 rounded-3xl border bg-card p-4 transition-all hover:-translate-y-0.5 hover:shadow-lg sm:p-5"
          >
            <div data-ui="page:/account/orders#OrdersList/div" className="min-w-0 flex-1 space-y-1">
              <div data-ui="page:/account/orders#OrdersList/div-flex-2" className="flex flex-wrap items-center gap-2">
                <span data-ui="page:/account/orders#OrdersList/span" className="font-mono font-semibold">{o.orderCode}</span>
                <StatusBadge status={o.status} />
                {isAwaitingPayment(o) && (
                  <span data-ui="page:/account/orders#OrdersList/span-2" className="rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground">Pay now</span>
                )}
                {o.status === "pending" && o.paymentStatus === "submitted" && (
                  <span data-ui="page:/account/orders#OrdersList/span-3" className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-900 dark:bg-sky-900/40 dark:text-sky-200">
                    Verifying payment
                  </span>
                )}
              </div>
              <p data-ui="page:/account/orders#OrdersList/p-3" className="truncate text-sm text-muted-foreground">
                {o.items.map((i) => `${i.name} × ${i.quantity}`).join(", ")}
              </p>
              <p data-ui="page:/account/orders#OrdersList/p-4" className="text-xs text-muted-foreground">{formatDate(o.createdAt)}</p>
              {isAwaitingPayment(o) && shop.unpaidOrderExpiryHours > 0 && (
                <p data-ui="page:/account/orders#OrdersList/p-5" className="text-xs font-medium text-amber-700 dark:text-amber-300">
                  Pay by {formatDeadline(paymentDeadline(o.createdAt, shop.unpaidOrderExpiryHours)!)} · unpaid orders are cancelled automatically after {describeHours(shop.unpaidOrderExpiryHours)}
                </p>
              )}
            </div>
            <span data-ui="page:/account/orders#OrdersList/span-4" className="font-semibold">{formatPrice(o.total)}</span>
            <ChevronRightIcon className="size-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
          </Link>
        </li>
      ))}
    </ul>
  )
}

export default function MyOrdersPage() {
  return (
    <section data-ui="page:/account/orders">
      <h2 data-ui="page:/account/orders/h2-my-orders" className="mb-6 text-3xl font-semibold">My orders</h2>
      <Suspense
        fallback={
          <div data-ui="page:/account/orders/div" className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton data-ui="page:/account/orders/Skeleton" key={i} className="h-24 rounded-3xl" />
            ))}
          </div>
        }
      >
        <OrdersList />
      </Suspense>
    </section>
  )
}
