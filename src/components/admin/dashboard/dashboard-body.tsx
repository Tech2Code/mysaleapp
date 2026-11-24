import { OrderStatusBadge } from "@/components/shared/order-status-badge"
import {
  ArrowRightIcon,
  ChevronRightIcon,
  IndianRupeeIcon,
  ReceiptIcon,
  ShoppingBagIcon,
} from "lucide-react"
import Link from "next/link"
import { change } from "@/components/admin/dashboard/delta"
import { DashboardCard } from "@/components/admin/dashboard/dashboard-card"
import { KpiCard } from "@/components/admin/dashboard/kpi-card"
import { SalesChart } from "@/components/admin/sales-chart"
import { Stagger, StaggerItem } from "@/components/shared/motion"
import { ProductImage } from "@/components/store/product-image"
import type { DashboardData } from "@/features/orders/admin-queries"
import { ORDER_STATUSES } from "@/features/orders/types"
import { formatDateTime, formatPrice } from "@/lib/format"
import { cn } from "@/lib/utils"

function FulfilmentGauge({ rate }: { rate: number }) {
  const clamped = Math.max(0, Math.min(100, rate))
  const r = 54
  const c = Math.PI * r
  const offset = c - (clamped / 100) * c
  return (
    <svg data-ui="admin/FulfilmentGauge" viewBox="0 0 140 84" className="mx-auto w-full max-w-[176px]" aria-hidden>
      <path
        d="M 16 70 A 54 54 0 0 1 124 70"
        fill="none"
        className="stroke-primary/15"
        strokeWidth="12"
        strokeLinecap="round"
      />
      <path
        d="M 16 70 A 54 54 0 0 1 124 70"
        fill="none"
        className="adminArcDraw stroke-primary"
        strokeWidth="12"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
      />
      <text x="70" y="59" textAnchor="middle" className="fill-foreground font-heading text-[26px] font-semibold tabular-nums">
        {clamped}%
      </text>
      <text x="70" y="76" textAnchor="middle" className="fill-muted-foreground text-[10px] font-medium">
        delivered rate
      </text>
    </svg>
  )
}

/** Everything under the date-range picker. Rendered by the page, by loading.tsx (placeholder data) and while the range reloads. */
export function DashboardBody({ d, bucket }: { d: DashboardData; bucket: "day" | "month" }) {
  const aovSeries = d.days.map((p) => (p.orders ? p.revenue / p.orders : 0))
  const totalOrdersInPipeline = ORDER_STATUSES.reduce((acc, s) => acc + d.byStatus[s], 0)
  const deliveredCount = d.byStatus.delivered ?? 0
  const cancelledCount = d.byStatus.cancelled ?? 0
  const inProgressCount = Math.max(0, totalOrdersInPipeline - deliveredCount - cancelledCount)
  const deliveredRate = totalOrdersInPipeline > 0 ? Math.round((deliveredCount / totalOrdersInPipeline) * 100) : 0

  const queueTotal =
    d.attention.toVerify +
    d.attention.awaitingPayment +
    d.attention.toFulfil +
    d.attention.returnRequests +
    d.attention.returnsToReceive +
    d.attention.refundsToSend

  const queueGroups = [
    {
      heading: "Payments",
      items: [
        {
          href: "/admin/orders?view=to-verify",
          label: "Payments to verify",
          hint: "Customer submitted UTR",
          count: d.attention.toVerify,
          dot: "bg-sky-500",
          urgent: true,
        },
        {
          href: "/admin/orders?view=awaiting-payment",
          label: "Payment rejected",
          hint: "Waiting for UTR update",
          count: d.attention.awaitingPayment,
          dot: "bg-amber-500",
        },
      ],
    },
    {
      heading: "Fulfilment",
      items: [
        {
          href: "/admin/orders?view=to-ship",
          label: "To pack & ship",
          hint: "Paid and confirmed",
          count: d.attention.toFulfil,
          dot: "bg-primary",
        },
      ],
    },
    {
      heading: "Returns & Refunds",
      items: [
        {
          href: "/admin/orders?view=return-requests",
          label: "Return requests",
          hint: "Awaiting your decision",
          count: d.attention.returnRequests,
          dot: "bg-rose-500",
        },
        {
          href: "/admin/orders?view=returns-to-receive",
          label: "Returns to receive",
          hint: "Approved, goods in transit",
          count: d.attention.returnsToReceive,
          dot: "bg-rose-400",
        },
        {
          href: "/admin/orders?view=return-refund-pending",
          label: "Refunds to send",
          hint: "Goods back, refund pending",
          count: d.attention.refundsToSend,
          dot: "bg-amber-500",
        },
      ],
    },
  ]

  return (
    <div data-ui="admin/DashboardBody" className="flex flex-col gap-4 xl:grid xl:grid-cols-12 xl:items-start">
      {/* ------------------------------------------------ Left Rail (Desktop) / Ordered for Mobile Usability */}
      <div data-ui="admin/DashboardBody/div" className="contents xl:col-span-4 xl:block xl:space-y-4">
        <div data-ui="admin/DashboardBody/div-2" className="order-2 xl:order-0">
          <DashboardCard
            title="Action queue"
            subtitle="Tasks needing review"
            action={
              <span data-ui="admin/DashboardBody/span"
                className={cn(
                  "inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-xs font-semibold tabular-nums",
                  queueTotal > 0 ? "bg-primary/12 text-primary" : "bg-muted text-muted-foreground"
                )}
              >
                {queueTotal}
              </span>
            }
          >
            <div data-ui="admin/DashboardBody/div-3" className="-m-4 divide-y divide-border/60 sm:-m-5">
              {queueGroups.map((group) => (
                <div data-ui="admin/DashboardBody/div-4" key={group.heading} className="py-3 first:pt-3.5 last:pb-3.5">
                  <p data-ui="admin/DashboardBody/p" className="px-4 pb-1.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase sm:px-5">
                    {group.heading}
                  </p>
                  <ul data-ui="admin/DashboardBody/ul">
                    {group.items.map((item) => {
                      const active = item.count > 0
                      return (
                        <li data-ui="admin/DashboardBody/li" key={item.href}>
                          <Link data-ui="admin/DashboardBody/Link"
                            href={item.href}
                            className={cn(
                              "group flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/50 sm:px-5",
                              !active && "opacity-65 hover:opacity-100"
                            )}
                          >
                            <span data-ui="admin/DashboardBody/span-flex" className="relative flex size-2.5 shrink-0 items-center justify-center">
                              {item.urgent && active && (
                                <span data-ui="admin/DashboardBody/span-2" className={cn("absolute inline-flex size-full animate-ping rounded-full opacity-60", item.dot)} aria-hidden />
                              )}
                              <span data-ui="admin/DashboardBody/span-3" className={cn("relative size-2 rounded-full", active ? item.dot : "bg-muted-foreground/35")} aria-hidden />
                            </span>
                            <div data-ui="admin/DashboardBody/div-5" className="min-w-0 flex-1">
                              <p data-ui="admin/DashboardBody/p-2" className="truncate text-[13px] font-medium text-foreground">{item.label}</p>
                              <p data-ui="admin/DashboardBody/p-3" className="truncate text-[11px] text-muted-foreground">{active ? item.hint : "All clear"}</p>
                            </div>
                            <span data-ui="admin/DashboardBody/span-4"
                              className={cn(
                                "inline-flex h-6 min-w-7 items-center justify-center rounded-md px-1.5 font-mono text-xs font-semibold tabular-nums",
                                active ? "bg-muted text-foreground" : "text-muted-foreground"
                              )}
                            >
                              {item.count}
                            </span>
                            <ChevronRightIcon className="size-3.5 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" aria-hidden />
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </DashboardCard>
        </div>

        <div data-ui="admin/DashboardBody/div-6" className="order-7 xl:order-0">
          <DashboardCard
            title="Inventory alerts"
            subtitle="Products running low"
            action={
              <Link data-ui="admin/DashboardBody/Link-manage" href="/admin/products" className="text-xs font-semibold text-primary hover:underline">
                Manage
              </Link>
            }
          >
            {d.lowStock.length === 0 ? (
              <p data-ui="admin/DashboardBody/p-4" className="py-4 text-center text-xs text-muted-foreground">Every product has healthy stock.</p>
            ) : (
              <ul data-ui="admin/DashboardBody/ul-2" className="-m-4 divide-y divide-border/60 sm:-m-5">
                {d.lowStock.map((p) => (
                  <li data-ui="admin/DashboardBody/li-2" key={p.id}>
                    <Link
                      data-ui="admin/DashboardBody/Link-flex"
                      href={`/admin/products/${encodeURIComponent(p.slug)}`}
                      className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/50 sm:px-5"
                    >
                      <span data-ui="admin/DashboardBody/span-relative" className="relative size-9 shrink-0 overflow-hidden rounded-lg bg-muted @container">
                        <ProductImage src={p.image} alt={p.name} sizes="36px" />
                      </span>
                      <span data-ui="admin/DashboardBody/span-5" className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">{p.name}</span>
                      <span
                        data-ui="admin/DashboardBody/span-6"
                        className={cn(
                          "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums",
                          p.stock === 0
                            ? "bg-red-500/12 text-red-700 dark:text-red-300"
                            : "bg-amber-500/12 text-amber-800 dark:text-amber-300"
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

      {/* ------------------------------------------------ Right Main Bento (Desktop) / Ordered for Mobile Usability */}
      <div data-ui="admin/DashboardBody/div-7" className="contents xl:col-span-8 xl:block xl:space-y-4">
        {/* Row 1: KPIs (First on mobile for instant pulse) */}
        <div data-ui="admin/DashboardBody/div-8" className="order-1 xl:order-0">
          <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-3" stagger={0.05}>
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
            <StaggerItem>
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
        </div>

        {/* Row 2: Sales Chart + Order Pipeline Gauge */}
        <div data-ui="admin/DashboardBody/div-9" className="contents lg:grid lg:grid-cols-12 lg:gap-4 xl:grid">
          <div data-ui="admin/DashboardBody/div-10" className="order-4 min-w-0 lg:col-span-8 xl:order-0">
            <DashboardCard
              title="Sales performance"
              subtitle="Verified payments only"
              action={<span data-ui="admin/DashboardBody/span-7" className="rounded-md bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground">{d.rangeLabel}</span>}
              className="h-full"
            >
              <SalesChart
                points={d.days.map((p) => ({ label: p.label, revenue: p.revenue, orders: p.orders }))}
                unit={bucket}
                rangeLabel={d.rangeLabel}
              />
            </DashboardCard>
          </div>

          <section data-ui="admin/DashboardBody/section-flex" className="adminHighlightCard order-5 flex flex-col justify-between rounded-xl border p-5 lg:col-span-4 xl:order-0">
            <div data-ui="admin/DashboardBody/div-flex" className="flex items-start justify-between gap-2">
              <div data-ui="admin/DashboardBody/div-11">
                <h2 data-ui="admin/DashboardBody/h2-order-pipeline" className="font-sans text-sm font-semibold text-foreground">Order pipeline</h2>
                <p data-ui="admin/DashboardBody/p-5" className="mt-0.5 text-[11px] text-muted-foreground">{d.rangeLabel}</p>
              </div>
              <span data-ui="admin/DashboardBody/span-8" className="rounded-full bg-primary/12 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-primary tabular-nums">
                {totalOrdersInPipeline} total
              </span>
            </div>

            <div data-ui="admin/DashboardBody/div-12" className="my-4">
              <FulfilmentGauge rate={deliveredRate} />
            </div>

            <div data-ui="admin/DashboardBody/div-13" className="space-y-1.5 border-t border-border/60 pt-3 text-xs">
              <Link data-ui="admin/DashboardBody/Link-flex-2" href="/admin/orders?status=delivered" className="flex items-center justify-between rounded-lg px-2 py-1.5 transition-colors hover:bg-primary/8">
                <span data-ui="admin/DashboardBody/span-flex-2" className="flex items-center gap-2 text-muted-foreground">
                  <span data-ui="admin/DashboardBody/span-9" className="size-2 rounded-full bg-emerald-500" aria-hidden /> Delivered
                </span>
                <span data-ui="admin/DashboardBody/span-10" className="font-mono font-semibold text-foreground tabular-nums">{deliveredCount}</span>
              </Link>
              <Link data-ui="admin/DashboardBody/Link-flex-3" href="/admin/orders?view=to-ship" className="flex items-center justify-between rounded-lg px-2 py-1.5 transition-colors hover:bg-primary/8">
                <span data-ui="admin/DashboardBody/span-flex-3" className="flex items-center gap-2 text-muted-foreground">
                  <span data-ui="admin/DashboardBody/span-11" className="size-2 rounded-full bg-primary" aria-hidden /> In progress
                </span>
                <span data-ui="admin/DashboardBody/span-12" className="font-mono font-semibold text-foreground tabular-nums">{inProgressCount}</span>
              </Link>
              <Link data-ui="admin/DashboardBody/Link-flex-4" href="/admin/orders?status=cancelled" className="flex items-center justify-between rounded-lg px-2 py-1.5 transition-colors hover:bg-primary/8">
                <span data-ui="admin/DashboardBody/span-flex-4" className="flex items-center gap-2 text-muted-foreground">
                  <span data-ui="admin/DashboardBody/span-13" className="size-2 rounded-full bg-rose-500" aria-hidden /> Cancelled
                </span>
                <span data-ui="admin/DashboardBody/span-14" className="font-mono font-semibold text-foreground tabular-nums">{cancelledCount}</span>
              </Link>
            </div>
          </section>
        </div>

        {/* Row 3: Recent Orders + Top Products */}
        <div data-ui="admin/DashboardBody/div-14" className="contents lg:grid lg:grid-cols-12 lg:gap-4 xl:grid">
          <div data-ui="admin/DashboardBody/div-15" className="order-3 min-w-0 lg:col-span-7 xl:order-0">
            <DashboardCard
              className="h-full"
              title="Recent orders"
              action={
                <Link data-ui="admin/DashboardBody/Link-view-all" href="/admin/orders" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                  View all <ArrowRightIcon className="size-3.5" />
                </Link>
              }
            >
              {d.recent.length === 0 ? (
                <p data-ui="admin/DashboardBody/p-6" className="py-8 text-center text-xs text-muted-foreground">
                  No orders yet. Share your store link on WhatsApp and Instagram to get the first one!
                </p>
              ) : (
                <ul data-ui="admin/DashboardBody/ul-3" className="-m-4 divide-y divide-border/60 sm:-m-5">
                  {d.recent.map((o) => (
                    <li data-ui="admin/DashboardBody/li-3" key={o.id}>
                      <Link
                        data-ui="admin/DashboardBody/Link-grid"
                        href={`/admin/orders/${encodeURIComponent(o.orderCode)}`}
                        className="grid items-center gap-x-3 gap-y-2 px-4 py-3 transition-colors hover:bg-muted/45 sm:grid-cols-[auto_1fr_auto] sm:px-5"
                      >
                        <div data-ui="admin/DashboardBody/div-flex-2" className="flex items-center gap-3 sm:contents">
                          <span
                            data-ui="admin/DashboardBody/span-grid"
                            className="grid size-8.5 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold text-foreground"
                            aria-hidden
                          >
                            {o.customerName.charAt(0).toUpperCase()}
                          </span>
                          <div data-ui="admin/DashboardBody/div-16" className="min-w-0">
                            <p data-ui="admin/DashboardBody/p-flex" className="flex flex-wrap items-center gap-x-2 text-[13px]">
                              <span data-ui="admin/DashboardBody/span-15" className="font-mono font-semibold text-foreground">{o.orderCode}</span>
                              <span data-ui="admin/DashboardBody/span-16" className="truncate text-muted-foreground">{o.customerName}</span>
                            </p>
                            <p data-ui="admin/DashboardBody/p-7" className="mt-0.5 text-[11px] text-muted-foreground">{formatDateTime(o.createdAt)}</p>
                          </div>
                        </div>
                        <div data-ui="admin/DashboardBody/div-flex-3" className="flex flex-wrap items-center gap-2 sm:justify-end">
                          <OrderStatusBadge status={o.status} returnStage={o.returnStage} paymentStatus={o.paymentStatus} audience="admin" />
                          <span data-ui="admin/DashboardBody/span-17" className="min-w-16 text-right font-mono text-[13px] font-semibold tabular-nums sm:ml-1">{formatPrice(o.total)}</span>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </DashboardCard>
          </div>

          <div data-ui="admin/DashboardBody/div-17" className="order-6 min-w-0 lg:col-span-5 xl:order-0">
            <DashboardCard title="Top products" subtitle="By verified revenue" className="h-full">
              {d.topProducts.length === 0 ? (
                <p data-ui="admin/DashboardBody/p-8" className="py-8 text-center text-xs text-muted-foreground">Your best sellers show up here once you get paid orders.</p>
              ) : (
                <ol data-ui="admin/DashboardBody/ol" className="space-y-3">
                  {d.topProducts.map((p, i) => (
                    <li data-ui="admin/DashboardBody/li-flex" key={p.productId} className="flex items-center gap-3">
                      <span data-ui="admin/DashboardBody/span-18" className="w-4 text-center font-mono text-xs font-semibold text-muted-foreground">{i + 1}</span>
                      <span data-ui="admin/DashboardBody/span-relative-2" className="relative size-10 shrink-0 overflow-hidden rounded-lg bg-muted @container">
                        <ProductImage src={p.image} alt={p.name} sizes="40px" />
                      </span>
                      <div data-ui="admin/DashboardBody/div-18" className="min-w-0 flex-1">
                        <p data-ui="admin/DashboardBody/p-9" className="truncate text-[13px] font-medium text-foreground">{p.name}</p>
                        <p data-ui="admin/DashboardBody/p-10" className="text-[11px] text-muted-foreground">{p.quantity} sold</p>
                      </div>
                      <p data-ui="admin/DashboardBody/p-11" className="font-mono text-[13px] font-semibold tabular-nums">{formatPrice(p.revenue)}</p>
                    </li>
                  ))}
                </ol>
              )}
            </DashboardCard>
          </div>
        </div>
      </div>
    </div>
  )
}
