import {
  ArrowDownRightIcon,
  ArrowRightIcon,
  ArrowUpRightIcon,
  BadgeIndianRupeeIcon,
  ClockIcon,
  ExternalLinkIcon,
  PackageCheckIcon,
  PlusIcon,
  Undo2Icon,
  type LucideIcon,
} from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { connection } from "next/server"
import type { ReactNode } from "react"
import { AreaChart, Sparkline } from "@/components/admin/charts"
import { Stagger, StaggerItem } from "@/components/shared/motion"
import { PaymentBadge } from "@/components/shared/payment-badge"
import { StatusBadge } from "@/components/shared/status-badge"
import { ProductImage } from "@/components/store/product-image"
import { buttonVariants } from "@/components/ui/button"
import { DashboardRangeShell } from "@/components/admin/dashboard-range"
import { getDashboard } from "@/features/orders/admin-queries"
import { istDayKey, resolveRange } from "@/features/orders/dashboard-range"
import { ORDER_STATUSES, STATUS_META } from "@/features/orders/types"
import { formatDateTime, formatPrice } from "@/lib/format"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Dashboard" }

/** % change vs the previous period. null = nothing to compare with. */
function change(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null
  return Math.round(((current - previous) / previous) * 100)
}

function Delta({ value, show = true }: { value: number | null; show?: boolean }) {
  if (!show) return null
  if (value === null) {
    return (
      <span data-ui="page:/admin#Delta" className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
        New
      </span>
    )
  }
  const up = value >= 0
  const Icon = up ? ArrowUpRightIcon : ArrowDownRightIcon
  return (
    <span
      data-ui="page:/admin#Delta"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold",
        up
          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
          : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200"
      )}
    >
      <Icon className="size-3" aria-hidden />
      {Math.abs(value)}%<span data-ui="page:/admin#Delta/span" className="sr-only"> {up ? "up" : "down"} from the previous period</span>
    </span>
  )
}

function Card({ title, action, children, className }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section data-ui="page:/admin#Card" className={cn("flex flex-col rounded-2xl border bg-card shadow-xs", className)}>
      <div data-ui="page:/admin#Card/div-flex" className="flex items-center justify-between gap-3 p-5 pb-0 sm:px-6 sm:pt-6">
        <h2 data-ui="page:/admin#Card/h2" className="font-sans text-base font-semibold">{title}</h2>
        {action}
      </div>
      <div data-ui="page:/admin#Card/div" className="flex-1 p-5 sm:p-6">{children}</div>
    </section>
  )
}

const TONES = {
  sky: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  violet: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  rose: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
} as const

function AttentionTile({
  href,
  icon: Icon,
  tone,
  count,
  label,
  hint,
  pulse,
}: {
  href: string
  icon: LucideIcon
  tone: keyof typeof TONES
  count: number
  label: string
  hint: string
  pulse?: boolean
}) {
  const active = count > 0
  return (
    <Link data-ui="page:/admin#AttentionTile"
      href={href}
      className={cn(
        "group flex items-center gap-4 rounded-2xl border bg-card p-4 transition-all hover:-translate-y-0.5 hover:shadow-md",
        active ? "shadow-xs" : "opacity-80"
      )}
    >
      <span data-ui="page:/admin#AttentionTile/span" className={cn("relative grid size-12 shrink-0 place-items-center rounded-2xl", TONES[tone])}>
        {pulse && active && (
          <span data-ui="page:/admin#AttentionTile/span-absolute" aria-hidden className="absolute inset-0 animate-ping rounded-2xl bg-current opacity-20 animation-duration-[2.4s]" />
        )}
        <Icon className="relative size-5" aria-hidden />
      </span>
      <div data-ui="page:/admin#AttentionTile/div" className="min-w-0 flex-1">
        <p data-ui="page:/admin#AttentionTile/p" className="font-heading text-2xl leading-none font-semibold">{count}</p>
        <p data-ui="page:/admin#AttentionTile/p-2" className="mt-1 truncate text-sm font-medium">{label}</p>
        <p data-ui="page:/admin#AttentionTile/p-3" className="truncate text-xs text-muted-foreground">{active ? hint : "All clear"}</p>
      </div>
      <ArrowRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
    </Link>
  )
}

function KpiCard({
  label,
  value,
  delta,
  showDelta,
  series,
  seriesLabel,
}: {
  label: string
  value: string
  delta: number | null
  showDelta: boolean
  series: number[]
  seriesLabel: string
}) {
  return (
    <div data-ui="page:/admin#KpiCard" className="h-full rounded-2xl border bg-card p-5 shadow-xs">
      <div data-ui="page:/admin#KpiCard/div-flex" className="flex items-center justify-between gap-2">
        <p data-ui="page:/admin#KpiCard/p" className="text-sm text-muted-foreground">{label}</p>
        <Delta value={delta} show={showDelta} />
      </div>
      <p data-ui="page:/admin#KpiCard/p-2" className="mt-2 font-heading text-3xl font-semibold tracking-tight">{value}</p>
      <Sparkline data={series} label={seriesLabel} className="mt-3" />
    </div>
  )
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

export default async function AdminDashboard({ searchParams }: PageProps<"/admin">) {
  const sp = await searchParams
  await connection() // the date range depends on "today", so this page is rendered per request
  const now = new Date()
  const range = resolveRange({ range: one(sp.range), month: one(sp.month), from: one(sp.from), to: one(sp.to) }, now)
  const d = await getDashboard(range)
  const maxStatus = Math.max(1, ...Object.values(d.byStatus))
  const aovSeries = d.days.map((p) => (p.orders ? p.revenue / p.orders : 0))
  const attentionTotal = d.attention.toVerify + d.attention.awaitingPayment + d.attention.toFulfil + d.attention.returnRequests + d.lowStock.length

  return (
    <div data-ui="page:/admin" className="space-y-6">
      {/* ------------------------------------------------ header */}
      <header data-ui="page:/admin/header-flex" className="flex flex-wrap items-end justify-between gap-4">
        <div data-ui="page:/admin/div">
          <p data-ui="page:/admin/p" className="text-sm text-muted-foreground">{d.todayLabel}</p>
          <h1 data-ui="page:/admin/h1" className="mt-1 text-2xl font-semibold sm:text-3xl">{d.greeting} 👋</h1>
          <p data-ui="page:/admin/p-2" className="mt-1 text-sm text-muted-foreground">
            {attentionTotal > 0
              ? `You have ${attentionTotal} thing${attentionTotal === 1 ? "" : "s"} that need attention.`
              : "Everything is under control."}
          </p>
        </div>
        <div data-ui="page:/admin/div-flex" className="flex flex-wrap gap-2">
          <Link data-ui="page:/admin/Link-view-store" href="/" target="_blank" className={cn(buttonVariants({ variant: "outline" }), "rounded-full")}>
            <ExternalLinkIcon /> View store
          </Link>
          <Link data-ui="page:/admin/Link-add-product" href="/admin/products/new" className={cn(buttonVariants(), "rounded-full px-5")}>
            <PlusIcon /> Add product
          </Link>
        </div>
      </header>

      <DashboardRangeShell current={{ key: range.key, from: range.from, to: range.to }} today={istDayKey(now)}>
        {/* ------------------------------------------------ needs attention */}
        <Stagger className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" stagger={0.05}>
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
              label="Awaiting payment"
              hint="Orders not yet paid"
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
        </Stagger>

        {/* ------------------------------------------------ KPIs */}
        <Stagger className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3" stagger={0.06}>
          <StaggerItem>
            <KpiCard
              label={`Revenue · ${d.rangeLabel}`}
              value={formatPrice(d.revenue.current)}
              showDelta={d.hasPrevious}
              delta={change(d.revenue.current, d.revenue.previous)}
              series={d.days.map((p) => p.revenue)}
              seriesLabel={`Revenue over ${d.rangeLabel}`}
            />
          </StaggerItem>
          <StaggerItem>
            <KpiCard
              label={`Orders · ${d.rangeLabel}`}
              value={String(d.orders.current)}
              showDelta={d.hasPrevious}
              delta={change(d.orders.current, d.orders.previous)}
              series={d.days.map((p) => p.orders)}
              seriesLabel={`Orders over ${d.rangeLabel}`}
            />
          </StaggerItem>
          <StaggerItem className="sm:col-span-2 xl:col-span-1">
            <KpiCard
              label={`Average order · ${d.rangeLabel}`}
              value={formatPrice(Math.round(d.averageOrder.current))}
              showDelta={d.hasPrevious}
              delta={change(d.averageOrder.current, d.averageOrder.previous)}
              series={aovSeries}
              seriesLabel={`Average order value over ${d.rangeLabel}`}
            />
          </StaggerItem>
        </Stagger>

        {/* ------------------------------------------------ charts + lists */}
        <div data-ui="page:/admin/div-grid" className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div data-ui="page:/admin/div-flex-2" className="flex min-w-0 flex-col gap-6">
            <Card
              title={`Revenue · ${d.rangeLabel}`}
              action={<span data-ui="page:/admin/span" className="text-xs text-muted-foreground">Verified payments only</span>}
            >
              <AreaChart
                data={d.days.map((p) => p.revenue)}
                labels={d.days.map((p) => p.label)}
                label={`Revenue over ${d.rangeLabel}`}
                formatValue={formatPrice}
              />
            </Card>

            <Card
              className="flex-1"
              title="Recent orders"
              action={
                <Link data-ui="page:/admin/Link-view-all" href="/admin/orders" className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                  View all <ArrowRightIcon className="size-4" />
                </Link>
              }
            >
              {d.recent.length === 0 ? (
                <p data-ui="page:/admin/p-3" className="py-8 text-center text-sm text-muted-foreground">
                  No orders yet. Share your store link on WhatsApp and Instagram to get the first one!
                </p>
              ) : (
                <ul data-ui="page:/admin/ul" className="-mx-5 -mb-5 divide-y border-t sm:-mx-6 sm:-mb-6">
                  {d.recent.map((o) => (
                    <li data-ui="page:/admin/li" key={o.id}>
                      <Link data-ui="page:/admin/Link-grid"
                        href={`/admin/orders/${o.id}`}
                        className="grid items-center gap-x-3 gap-y-2 p-4 transition-colors hover:bg-muted/50 sm:grid-cols-[auto_1fr_auto] sm:px-6"
                      >
                        <div data-ui="page:/admin/div-flex-3" className="flex items-center gap-3 sm:contents">
                          <span data-ui="page:/admin/span-grid"
                            className="grid size-10 shrink-0 place-items-center rounded-full bg-secondary text-sm font-semibold text-primary"
                            aria-hidden
                          >
                            {o.customerName.charAt(0).toUpperCase()}
                          </span>
                          <div data-ui="page:/admin/div-2" className="min-w-0">
                            <p data-ui="page:/admin/p-flex" className="flex flex-wrap items-center gap-x-2 text-sm">
                              <span data-ui="page:/admin/span-2" className="font-mono font-semibold">{o.orderCode}</span>
                              <span data-ui="page:/admin/span-3" className="truncate text-muted-foreground">{o.customerName}</span>
                            </p>
                            <p data-ui="page:/admin/p-4" className="mt-0.5 text-xs text-muted-foreground">{formatDateTime(o.createdAt)}</p>
                          </div>
                        </div>
                        <div data-ui="page:/admin/div-flex-4" className="flex flex-wrap items-center gap-2 sm:justify-end">
                          <StatusBadge status={o.status} />
                          <PaymentBadge status={o.paymentStatus} orderStatus={o.status} />
                          <span data-ui="page:/admin/span-4" className="min-w-16 text-right text-sm font-semibold sm:ml-2">{formatPrice(o.total)}</span>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <div data-ui="page:/admin/div-flex-5" className="flex min-w-0 flex-col gap-6">
            <Card title={`Order pipeline · ${d.rangeLabel}`}>
              <ul data-ui="page:/admin/ul-2" className="space-y-3.5">
                {ORDER_STATUSES.map((s) => (
                  <li data-ui="page:/admin/li-2" key={s}>
                    <Link data-ui="page:/admin/Link" href={`/admin/orders?status=${s}`} className="group block">
                      <div data-ui="page:/admin/div-flex-6" className="flex justify-between text-sm">
                        <span data-ui="page:/admin/span-5" className="group-hover:text-primary">{STATUS_META[s].label}</span>
                        <span data-ui="page:/admin/span-6" className="font-semibold tabular-nums">{d.byStatus[s]}</span>
                      </div>
                      <div data-ui="page:/admin/div-3" className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                        <div data-ui="page:/admin/div-4"
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
            </Card>

            <Card title="Top products" action={<span data-ui="page:/admin/span-7" className="text-xs text-muted-foreground">By revenue</span>}>
              {d.topProducts.length === 0 ? (
                <p data-ui="page:/admin/p-5" className="py-4 text-center text-sm text-muted-foreground">Your best sellers show up here once you get paid orders.</p>
              ) : (
                <ol data-ui="page:/admin/ol" className="space-y-3">
                  {d.topProducts.map((p, i) => (
                    <li data-ui="page:/admin/li-flex" key={p.productId} className="flex items-center gap-3">
                      <span data-ui="page:/admin/span-8" className="w-4 text-center text-xs font-semibold text-muted-foreground">{i + 1}</span>
                      <span data-ui="page:/admin/span-relative" className="relative size-11 shrink-0 overflow-hidden rounded-xl bg-muted @container">
                        <ProductImage src={p.image} alt={p.name} sizes="44px" />
                      </span>
                      <div data-ui="page:/admin/div-5" className="min-w-0 flex-1">
                        <p data-ui="page:/admin/p-6" className="truncate text-sm font-medium">{p.name}</p>
                        <p data-ui="page:/admin/p-7" className="text-xs text-muted-foreground">{p.quantity} sold</p>
                      </div>
                      <p data-ui="page:/admin/p-8" className="text-sm font-semibold">{formatPrice(p.revenue)}</p>
                    </li>
                  ))}
                </ol>
              )}
            </Card>

            <Card
              className="flex-1"
              title="Low stock"
              action={
                <Link data-ui="page:/admin/Link-manage" href="/admin/products" className="text-sm font-medium text-primary">
                  Manage
                </Link>
              }
            >
              {d.lowStock.length === 0 ? (
                <p data-ui="page:/admin/p-9" className="py-4 text-center text-sm text-muted-foreground">Every product has healthy stock.</p>
              ) : (
                <ul data-ui="page:/admin/ul-3" className="space-y-3">
                  {d.lowStock.map((p) => (
                    <li data-ui="page:/admin/li-3" key={p.id}>
                      <Link data-ui="page:/admin/Link-flex" href={`/admin/products/${p.id}`} className="flex items-center gap-3 hover:text-primary">
                        <span data-ui="page:/admin/span-relative-2" className="relative size-10 shrink-0 overflow-hidden rounded-lg bg-muted @container">
                          <ProductImage src={p.image} alt={p.name} sizes="40px" />
                        </span>
                        <span data-ui="page:/admin/span-9" className="min-w-0 flex-1 truncate text-sm font-medium">{p.name}</span>
                        <span data-ui="page:/admin/span-10"
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
            </Card>
          </div>
        </div>
      </DashboardRangeShell>
    </div>
  )
}
