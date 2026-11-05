import { ChevronRightIcon, PackageIcon } from "lucide-react"
import Link from "next/link"
import { Suspense } from "react"
import { StatusBadge } from "@/components/shared/status-badge"
import { buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { getMyOrders } from "@/features/orders/queries"
import { formatDate, formatPrice } from "@/lib/format"
import { cn } from "@/lib/utils"

async function OrdersList() {
  const orders = await getMyOrders()

  if (orders.length === 0) {
    return (
      <div data-ui="page:/account/orders#OrdersList" className="flex flex-col items-center gap-4 rounded-3xl border border-dashed py-14 sm:py-20 text-center">
        <PackageIcon className="size-10 text-muted-foreground" />
        <p className="font-heading text-2xl">No orders yet</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Orders you place while signed in appear here. Guest orders can be tracked with their order code.
        </p>
        <div className="flex gap-3">
          <Link href="/products" className={cn(buttonVariants(), "rounded-full px-5")}>
            Start shopping
          </Link>
          <Link href="/track" className={cn(buttonVariants({ variant: "outline" }), "rounded-full px-5")}>
            Track a guest order
          </Link>
        </div>
      </div>
    )
  }

  return (
    <ul data-ui="page:/account/orders#OrdersList" className="space-y-3">
      {orders.map((o) => (
        <li key={o.id}>
          <Link
            href={`/account/orders/${o.orderCode}`}
            className="group flex items-center gap-4 rounded-3xl border bg-card p-4 transition-all hover:-translate-y-0.5 hover:shadow-lg sm:p-5"
          >
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono font-semibold">{o.orderCode}</span>
                <StatusBadge status={o.status} />
                {o.status === "pending" && (o.paymentStatus === "pending" || o.paymentStatus === "failed") && (
                  <span className="rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground">Pay now</span>
                )}
                {o.status === "pending" && o.paymentStatus === "submitted" && (
                  <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-900 dark:bg-sky-900/40 dark:text-sky-200">
                    Verifying payment
                  </span>
                )}
              </div>
              <p className="truncate text-sm text-muted-foreground">
                {o.items.map((i) => `${i.name} × ${i.quantity}`).join(", ")}
              </p>
              <p className="text-xs text-muted-foreground">{formatDate(o.createdAt)}</p>
            </div>
            <span className="font-semibold">{formatPrice(o.total)}</span>
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
      <h2 className="mb-6 text-3xl font-semibold">My orders</h2>
      <Suspense
        fallback={
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-24 rounded-3xl" />
            ))}
          </div>
        }
      >
        <OrdersList />
      </Suspense>
    </section>
  )
}
