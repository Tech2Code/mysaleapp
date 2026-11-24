import { OrderStatusBadge } from "@/components/shared/order-status-badge"
import {
  ArrowRightIcon,
  ChevronRightIcon,
  IndianRupeeIcon,
  ReceiptIcon,
  ShoppingBagIcon,
} from "lucide-react"
import Link from "next/link"
import styles from "@/components/admin/admin-core.module.css"
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
    <svg viewBox="0 0 140 84" className={styles.gaugeSvg} aria-hidden>
      <path
        d="M 16 70 A 54 54 0 0 1 124 70"
        fill="none"
        className={styles.gaugeTrack}
        strokeWidth="12"
        strokeLinecap="round"
      />
      <path
        d="M 16 70 A 54 54 0 0 1 124 70"
        fill="none"
        className={cn("adminArcDraw", styles.gaugeArc)}
        strokeWidth="12"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
      />
      <text x="70" y="59" textAnchor="middle" className={styles.gaugeRateText}>
        {clamped}%
      </text>
      <text x="70" y="76" textAnchor="middle" className={styles.gaugeSubText}>
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
          dot: styles.dotBgSky,
          urgent: true,
        },
        {
          href: "/admin/orders?view=awaiting-payment",
          label: "Payment rejected",
          hint: "Waiting for UTR update",
          count: d.attention.awaitingPayment,
          dot: styles.dotBgAmber,
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
          dot: styles.dotBgPrimary,
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
          dot: styles.dotBgRose,
        },
        {
          href: "/admin/orders?view=returns-to-receive",
          label: "Returns to receive",
          hint: "Approved, goods in transit",
          count: d.attention.returnsToReceive,
          dot: styles.dotBgRoseLight,
        },
        {
          href: "/admin/orders?view=return-refund-pending",
          label: "Refunds to send",
          hint: "Goods back, refund pending",
          count: d.attention.refundsToSend,
          dot: styles.dotBgAmber,
        },
      ],
    },
  ]

  return (
    <div className={styles.dashboardBento}>
      {/* ------------------------------------------------ Left Rail (Desktop) / Ordered for Mobile Usability */}
      <div className={styles.bentoRailCol}>
        <div className={styles.order2Mobile}>
          <DashboardCard
            title="Action queue"
            subtitle="Tasks needing review"
            action={
              <span
                className={cn(
                  styles.queueTotalPill,
                  queueTotal > 0 ? styles.queueTotalActive : styles.queueTotalIdle
                )}
              >
                {queueTotal}
              </span>
            }
          >
            <div className={styles.bleedListWrap}>
              {queueGroups.map((group) => (
                <div key={group.heading} className={styles.queueGroupSection}>
                  <p className={styles.queueGroupHeading}>
                    {group.heading}
                  </p>
                  <ul className={styles.queueGroupUl}>
                    {group.items.map((item) => {
                      const active = item.count > 0
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            className={cn(
                              styles.queueItemLink,
                              !active && styles.queueItemIdle
                            )}
                          >
                            <span className={styles.queueDotWrap}>
                              {item.urgent && active && (
                                <span className={cn(styles.queueDotPing, item.dot)} aria-hidden />
                              )}
                              <span className={cn(styles.queueDotCore, active ? item.dot : styles.dotBgMuted)} aria-hidden />
                            </span>
                            <div className={styles.queueItemText}>
                              <p className={styles.queueItemTitle}>{item.label}</p>
                              <p className={styles.queueItemHint}>{active ? item.hint : "All clear"}</p>
                            </div>
                            <span
                              className={cn(
                                styles.queueCountBadge,
                                active ? styles.queueCountActive : styles.queueCountIdle
                              )}
                            >
                              {item.count}
                            </span>
                            <ChevronRightIcon className={styles.queueChevron} aria-hidden />
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

        <div className={styles.order7Mobile}>
          <DashboardCard
            title="Inventory alerts"
            subtitle="Products running low"
            action={
              <Link href="/admin/products" className={styles.cardActionLink}>
                Manage
              </Link>
            }
          >
            {d.lowStock.length === 0 ? (
              <p className={styles.emptySmallState}>Every product has healthy stock.</p>
            ) : (
              <ul className={styles.bleedListWrap}>
                {d.lowStock.map((p) => (
                  <li key={p.id}>
                    <Link

                      href={`/admin/products/${encodeURIComponent(p.slug)}`}
                      className={styles.lowStockRowLink}
                    >
                      <span className={styles.thumbBox36}>
                        <ProductImage src={p.image} alt={p.name} sizes="36px" />
                      </span>
                      <span className={styles.lowStockName}>{p.name}</span>
                      <span

                        className={cn(
                          styles.stockPill,
                          p.stock === 0 ? styles.stockZero : styles.stockLow
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
      <div className={styles.bentoMainCol}>
        {/* Row 1: KPIs (First on mobile for instant pulse) */}
        <div className={styles.order1Mobile}>
          <Stagger className={styles.kpiStaggerGrid} stagger={0.05}>
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
        <div className={styles.bentoSplitRow}>
          <div className={cn(styles.order4Mobile, styles.bentoCol8)}>
            <DashboardCard
              title="Sales performance"
              subtitle="Verified payments only"
              action={<span className={styles.rangeBadgeMuted}>{d.rangeLabel}</span>}
              className={styles.dashboardCardFull}
            >
              <SalesChart
                points={d.days.map((p) => ({ label: p.label, revenue: p.revenue, orders: p.orders }))}
                unit={bucket}
                rangeLabel={d.rangeLabel}
              />
            </DashboardCard>
          </div>

          <section className={cn("adminHighlightCard", styles.order5Mobile, styles.pipelineCard)}>
            <div className={styles.pipelineHeader}>
              <div>
                <h2 className={styles.pipelineTitle}>Order pipeline</h2>
                <p className={styles.pipelineSub}>{d.rangeLabel}</p>
              </div>
              <span className={styles.pipelineTotalPill}>
                {totalOrdersInPipeline} total
              </span>
            </div>

            <div className={styles.gaugeWrap}>
              <FulfilmentGauge rate={deliveredRate} />
            </div>

            <div className={styles.pipelineLegend}>
              <Link href="/admin/orders?status=delivered" className={styles.pipelineLinkRow}>
                <span className={styles.legendLabelLeft}>
                  <span className={cn(styles.legendDot, styles.dotBgEmerald)} aria-hidden /> Delivered
                </span>
                <span className={styles.legendCountMono}>{deliveredCount}</span>
              </Link>
              <Link href="/admin/orders?view=to-ship" className={styles.pipelineLinkRow}>
                <span className={styles.legendLabelLeft}>
                  <span className={cn(styles.legendDot, styles.dotBgPrimary)} aria-hidden /> In progress
                </span>
                <span className={styles.legendCountMono}>{inProgressCount}</span>
              </Link>
              <Link href="/admin/orders?status=cancelled" className={styles.pipelineLinkRow}>
                <span className={styles.legendLabelLeft}>
                  <span className={cn(styles.legendDot, styles.dotBgRose)} aria-hidden /> Cancelled
                </span>
                <span className={styles.legendCountMono}>{cancelledCount}</span>
              </Link>
            </div>
          </section>
        </div>

        {/* Row 3: Recent Orders + Top Products */}
        <div className={styles.bentoSplitRow}>
          <div className={cn(styles.order3Mobile, styles.bentoCol7)}>
            <DashboardCard
              className={styles.dashboardCardFull}
              title="Recent orders"
              action={
                <Link href="/admin/orders" className={styles.cardActionLink}>
                  View all <ArrowRightIcon className={styles.icon14} />
                </Link>
              }
            >
              {d.recent.length === 0 ? (
                <p className={styles.emptyLargeState}>
                  No orders yet. Share your store link on WhatsApp and Instagram to get the first one!
                </p>
              ) : (
                <ul className={styles.bleedListWrap}>
                  {d.recent.map((o) => (
                    <li key={o.id}>
                      <Link

                        href={`/admin/orders/${encodeURIComponent(o.orderCode)}`}
                        className={styles.recentOrderLink}
                      >
                        <div className={styles.recentOrderLeft}>
                          <span

                            className={styles.customerAvatar}
                            aria-hidden
                          >
                            {o.customerName.charAt(0).toUpperCase()}
                          </span>
                          <div className={styles.orderMetaCol}>
                            <p className={styles.orderTitleLine}>
                              <span className={styles.orderCodeMono}>{o.orderCode}</span>
                              <span className={styles.customerNameTrunc}>{o.customerName}</span>
                            </p>
                            <p className={styles.orderDateLine}>{formatDateTime(o.createdAt)}</p>
                          </div>
                        </div>
                        <div className={styles.recentOrderRight}>
                          <OrderStatusBadge status={o.status} returnStage={o.returnStage} paymentStatus={o.paymentStatus} audience="admin" />
                          <span className={styles.orderTotalMono}>{formatPrice(o.total)}</span>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </DashboardCard>
          </div>

          <div className={cn(styles.order6Mobile, styles.bentoCol5)}>
            <DashboardCard title="Top products" subtitle="By verified revenue" className={styles.dashboardCardFull}>
              {d.topProducts.length === 0 ? (
                <p className={styles.emptyLargeState}>Your best sellers show up here once you get paid orders.</p>
              ) : (
                <ol className={styles.topProductsOl}>
                  {d.topProducts.map((p, i) => (
                    <li key={p.productId} className={styles.topProductLi}>
                      <span className={styles.rankNum}>{i + 1}</span>
                      <span className={styles.thumbBox40}>
                        <ProductImage src={p.image} alt={p.name} sizes="40px" />
                      </span>
                      <div className={styles.topProductMeta}>
                        <p className={styles.topProductName}>{p.name}</p>
                        <p className={styles.topProductSold}>{p.quantity} sold</p>
                      </div>
                      <p className={styles.topProductRev}>{formatPrice(p.revenue)}</p>
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
