import { OrderStatusBadge } from "@/components/shared/order-status-badge"
import {
  ArrowRightIcon,
  BadgeIndianRupeeIcon,
  ClockIcon,
  HandCoinsIcon,
  IndianRupeeIcon,
  PackageCheckIcon,
  PackageOpenIcon,
  ReceiptIcon,
  ShoppingBagIcon,
  Undo2Icon,
} from "lucide-react"
import Link from "next/link"
import { AttentionTile } from "@/components/admin/dashboard/attention-tile"
import { change } from "@/components/admin/dashboard/delta"
import { DashboardCard } from "@/components/admin/dashboard/dashboard-card"
import { KpiCard } from "@/components/admin/dashboard/kpi-card"
import { SalesChart } from "@/components/admin/sales-chart"
import { Stagger, StaggerItem } from "@/components/shared/motion"
import { ProductImage } from "@/components/store/product-image"
import type { DashboardData } from "@/features/orders/admin-queries"
import { ORDER_STATUSES, STATUS_META } from "@/features/orders/types"
import { formatDateTime, formatPrice } from "@/lib/format"
import { cn } from "@/lib/utils"

/** Everything under the date-range picker. Rendered by the page, by loading.tsx (placeholder data) and while the range reloads. */
export function DashboardBody({ d, bucket }: { d: DashboardData; bucket: "day" | "month" }) {
  const maxStatus = Math.max(1, ...Object.values(d.byStatus))
  const aovSeries = d.days.map((p) => (p.orders ? p.revenue / p.orders : 0))

  return (
    <>
    {/* ------------------------------------------------ needs attention */}
    <Stagger className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3" stagger={0.05}>
      <StaggerItem>
        <AttentionTile
          href="/admin/orders?view=to-verify"
          icon={BadgeIndianRupeeIcon}
          tone="sky"
          count={d.attention.toVerify}
          label="Payments to verify"
          hint="Customer says they paid"
          pulse
        />
      </StaggerItem>
      <StaggerItem>
        <AttentionTile
          href="/admin/orders?view=awaiting-payment"
          icon={ClockIcon}
          tone="amber"
          count={d.attention.awaitingPayment}
          label="Payment rejected"
          hint="Waiting for customer to update UTR"
        />
      </StaggerItem>
      <StaggerItem>
        <AttentionTile
          href="/admin/orders?view=to-ship"
          icon={PackageCheckIcon}
          tone="violet"
          count={d.attention.toFulfil}
          label="To pack & ship"
          hint="Paid and confirmed"
        />
      </StaggerItem>
      <StaggerItem>
        <AttentionTile
          href="/admin/orders?view=return-requests"
          icon={Undo2Icon}
          tone="rose"
          count={d.attention.returnRequests}
          label="Return requests"
          hint="Waiting for your decision"
        />
      </StaggerItem>
      <StaggerItem>
        <AttentionTile
          href="/admin/orders?view=returns-to-receive"
          icon={PackageOpenIcon}
          tone="rose"
          count={d.attention.returnsToReceive}
          label="Returns to receive"
          hint="Approved, goods not back yet"
        />
      </StaggerItem>
      <StaggerItem>
        <AttentionTile
          href="/admin/orders?view=return-refund-pending"
          icon={HandCoinsIcon}
          tone="amber"
          count={d.attention.refundsToSend}
          label="Refunds to send"
          hint="Goods back, no refund recorded"
        />
      </StaggerItem>
    </Stagger>

    {/* ------------------------------------------------ KPIs */}
    <Stagger className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3" stagger={0.06}>
      <StaggerItem>
        <KpiCard
          label="Revenue"
          period={d.rangeLabel}
          icon={IndianRupeeIcon}
          tone="emerald"
          value={formatPrice(d.revenue.current)}
          showDelta={d.hasPrevious}
          delta={change(d.revenue.current, d.revenue.previous)}
          series={d.days.map((p) => p.revenue)}
          seriesLabel={`Revenue over ${d.rangeLabel}`}
        />
      </StaggerItem>
      <StaggerItem>
        <KpiCard
          label="Orders"
          period={d.rangeLabel}
          icon={ShoppingBagIcon}
          tone="sky"
          value={String(d.orders.current)}
          showDelta={d.hasPrevious}
          delta={change(d.orders.current, d.orders.previous)}
          series={d.days.map((p) => p.orders)}
          seriesLabel={`Orders over ${d.rangeLabel}`}
        />
      </StaggerItem>
      <StaggerItem className="sm:col-span-2 xl:col-span-1">
        <KpiCard
          label="Average order"
          period={d.rangeLabel}
          icon={ReceiptIcon}
          tone="violet"
          value={formatPrice(Math.round(d.averageOrder.current))}
          showDelta={d.hasPrevious}
          delta={change(d.averageOrder.current, d.averageOrder.previous)}
          series={aovSeries}
          seriesLabel={`Average order value over ${d.rangeLabel}`}
        />
      </StaggerItem>
    </Stagger>

    {/* ------------------------------------------------ charts + lists */}
    <div data-ui="admin/DashboardBody/div-grid" className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div data-ui="admin/DashboardBody/div-flex" className="flex min-w-0 flex-col gap-6">
        <DashboardCard
          title="Sales"
          action={<span data-ui="admin/DashboardBody/span" className="text-xs text-muted-foreground">Verified payments only</span>}
        >
          <SalesChart
            points={d.days.map((p) => ({ label: p.label, revenue: p.revenue, orders: p.orders }))}
            unit={bucket}
            rangeLabel={d.rangeLabel}
          />
        </DashboardCard>

        <DashboardCard
          className="flex-1"
          title="Recent orders"
          action={
            <Link data-ui="admin/DashboardBody/Link-view-all" href="/admin/orders" className="inline-flex items-center gap-1 text-sm font-medium text-primary">
              View all <ArrowRightIcon className="size-4" />
            </Link>
          }
        >
          {d.recent.length === 0 ? (
            <p data-ui="admin/DashboardBody/p" className="py-8 text-center text-sm text-muted-foreground">
              No orders yet. Share your store link on WhatsApp and Instagram to get the first one!
            </p>
          ) : (
            <ul data-ui="admin/DashboardBody/ul" className="-mx-5 -mb-5 divide-y border-t sm:-mx-6 sm:-mb-6">
              {d.recent.map((o) => (
                <li data-ui="admin/DashboardBody/li" key={o.id}>
                  <Link data-ui="admin/DashboardBody/Link-grid"
                    href={`/admin/orders/${o.id}`}
                    prefetch={true}
                    className="grid items-center gap-x-3 gap-y-2 p-4 transition-colors hover:bg-muted/50 sm:grid-cols-[auto_1fr_auto] sm:px-6"
                  >
                    <div data-ui="admin/DashboardBody/div-flex-2" className="flex items-center gap-3 sm:contents">
                      <span data-ui="admin/DashboardBody/span-grid"
                        className="grid size-10 shrink-0 place-items-center rounded-full bg-secondary text-sm font-semibold text-primary"
                        aria-hidden
                      >
                        {o.customerName.charAt(0).toUpperCase()}
                      </span>
                      <div data-ui="admin/DashboardBody/div" className="min-w-0">
                        <p data-ui="admin/DashboardBody/p-flex" className="flex flex-wrap items-center gap-x-2 text-sm">
                          <span data-ui="admin/DashboardBody/span-2" className="font-mono font-semibold">{o.orderCode}</span>
                          <span data-ui="admin/DashboardBody/span-3" className="truncate text-muted-foreground">{o.customerName}</span>
                        </p>
                        <p data-ui="admin/DashboardBody/p-2" className="mt-0.5 text-xs text-muted-foreground">{formatDateTime(o.createdAt)}</p>
                      </div>
                    </div>
                    <div data-ui="admin/DashboardBody/div-flex-3" className="flex flex-wrap items-center gap-2 sm:justify-end">
                      <OrderStatusBadge status={o.status} returnStage={o.returnStage} paymentStatus={o.paymentStatus} audience="admin" />
                      <span data-ui="admin/DashboardBody/span-4" className="min-w-16 text-right text-sm font-semibold sm:ml-2">{formatPrice(o.total)}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </DashboardCard>
      </div>

      <div data-ui="admin/DashboardBody/div-flex-4" className="flex min-w-0 flex-col gap-6">
        <DashboardCard title={`Order pipeline · ${d.rangeLabel}`}>
          <ul data-ui="admin/DashboardBody/ul-2" className="space-y-3.5">
            {ORDER_STATUSES.map((s) => (
              <li data-ui="admin/DashboardBody/li-2" key={s}>
                <Link data-ui="admin/DashboardBody/Link" href={`/admin/orders?status=${s}`} className="group block">
                  <div data-ui="admin/DashboardBody/div-flex-5" className="flex justify-between text-sm">
                    <span data-ui="admin/DashboardBody/span-5" className="group-hover:text-primary">{STATUS_META[s].label}</span>
                    <span data-ui="admin/DashboardBody/span-6" className="font-semibold tabular-nums">{d.byStatus[s]}</span>
                  </div>
                  <div data-ui="admin/DashboardBody/div-2" className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                    <div data-ui="admin/DashboardBody/div-3"
                      className={cn(
                        "h-full rounded-full",
                        s === "cancelled" ? "bg-destructive/70" : s === "delivered" ? "bg-success" : "bg-primary/80"
                      )}
                      style={{
                        width: `${(d.byStatus[s] / maxStatus) * 100}%`,
                      }}
                    />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </DashboardCard>

        <DashboardCard title="Top products" action={<span data-ui="admin/DashboardBody/span-7" className="text-xs text-muted-foreground">By revenue</span>}>
          {d.topProducts.length === 0 ? (
            <p data-ui="admin/DashboardBody/p-3" className="py-4 text-center text-sm text-muted-foreground">Your best sellers show up here once you get paid orders.</p>
          ) : (
            <ol data-ui="admin/DashboardBody/ol" className="space-y-3">
              {d.topProducts.map((p, i) => (
                <li data-ui="admin/DashboardBody/li-flex" key={p.productId} className="flex items-center gap-3">
                  <span data-ui="admin/DashboardBody/span-8" className="w-4 text-center text-xs font-semibold text-muted-foreground">{i + 1}</span>
                  <span data-ui="admin/DashboardBody/span-relative" className="relative size-11 shrink-0 overflow-hidden rounded-xl bg-muted @container">
                    <ProductImage src={p.image} alt={p.name} sizes="44px" />
                  </span>
                  <div data-ui="admin/DashboardBody/div-4" className="min-w-0 flex-1">
                    <p data-ui="admin/DashboardBody/p-4" className="truncate text-sm font-medium">{p.name}</p>
                    <p data-ui="admin/DashboardBody/p-5" className="text-xs text-muted-foreground">{p.quantity} sold</p>
                  </div>
                  <p data-ui="admin/DashboardBody/p-6" className="text-sm font-semibold">{formatPrice(p.revenue)}</p>
                </li>
              ))}
            </ol>
          )}
        </DashboardCard>

        <DashboardCard
          className="flex-1"
          title="Low stock"
          action={
            <Link data-ui="admin/DashboardBody/Link-manage" href="/admin/products" className="text-sm font-medium text-primary">
              Manage
            </Link>
          }
        >
          {d.lowStock.length === 0 ? (
            <p data-ui="admin/DashboardBody/p-7" className="py-4 text-center text-sm text-muted-foreground">Every product has healthy stock.</p>
          ) : (
            <ul data-ui="admin/DashboardBody/ul-3" className="space-y-3">
              {d.lowStock.map((p) => (
                <li data-ui="admin/DashboardBody/li-3" key={p.id}>
                  <Link data-ui="admin/DashboardBody/Link-flex" href={`/admin/products/${p.id}`} prefetch={true} className="flex items-center gap-3 hover:text-primary">
                    <span data-ui="admin/DashboardBody/span-relative-2" className="relative size-10 shrink-0 overflow-hidden rounded-lg bg-muted @container">
                      <ProductImage src={p.image} alt={p.name} sizes="40px" />
                    </span>
                    <span data-ui="admin/DashboardBody/span-9" className="min-w-0 flex-1 truncate text-sm font-medium">{p.name}</span>
                    <span data-ui="admin/DashboardBody/span-10"
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-semibold",
                        p.stock === 0
                          ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200"
                          : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
                      )}
                    >
                      {p.stock === 0 ? "Sold out" : `${p.stock} left`}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </DashboardCard>
      </div>
    </div>
    </>
  )
}
