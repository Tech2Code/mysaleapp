"use client"

import { ArrowRightIcon, ClockIcon, LayoutGridIcon, ListIcon, PackageIcon, ShieldCheckIcon, UserIcon } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { OrderStatusBadge } from "@/components/shared/order-status-badge"
import { PaymentBadge } from "@/components/shared/payment-badge"
import { SegmentedTabs } from "@/components/shared/segmented-tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { Order } from "@/features/orders/types"
import { formatDateTime, formatPrice } from "@/lib/format"
import { cn } from "@/lib/utils"
import styles from "./admin-orders.module.css"

const SEEN_ORDERS_KEY = "admin_seen_orders"
const MAX_SEEN_ORDERS = 500

type ActorTag = { label: string; kind: "admin" | "customer" | "system" }

/** Compact actor indicator for admin list rows: who cancelled, rejected, or opened a return/exchange. */
function getStatusActorTag(o: Order): ActorTag | null {
  if (o.status === "cancelled") {
    if (o.cancellation?.by === "admin") return { label: "Cancelled by admin", kind: "admin" }
    if (o.cancellation?.by === "customer") return { label: "Cancelled by customer", kind: "customer" }
    if (o.cancellation?.by === "system") return { label: "Auto-cancelled", kind: "system" }
    return null
  }
  if (o.status === "delivered" && o.returnStage) {
    if (o.returnStage.key === "rejected") return { label: "Rejected by admin", kind: "admin" }
    if (o.returnStage.key === "withdrawn") return { label: "Return cancelled by customer", kind: "customer" }
    if (o.returnStage.directReturn) return { label: "Return recorded by admin", kind: "admin" }
    return o.returnStage.requestedBy === "admin"
      ? { label: "Requested by admin", kind: "admin" }
      : { label: "Requested by customer", kind: "customer" }
  }
  return null
}

function ActorMetaLine({ tag }: { tag: ActorTag | null }) {
  if (!tag) return null
  const Icon = tag.kind === "admin" ? ShieldCheckIcon : tag.kind === "system" ? ClockIcon : UserIcon
  return (
    <div className={styles.actorMetaLine}>
      <Icon
        aria-hidden
        className={cn(
          styles.actorMetaIcon,
          tag.kind === "admin"
            ? styles.actorMetaIconAdmin
            : tag.kind === "system"
              ? styles.actorMetaIconSystem
              : styles.actorMetaIconCustomer
        )}
      />
      <span>{tag.label}</span>
    </div>
  )
}

function readSeenOrders(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_ORDERS_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return new Set(parsed.filter((id): id is string => typeof id === "string"))
    }
  } catch {}
  return new Set()
}

function writeSeenOrders(ids: Set<string>) {
  try {
    const list = Array.from(ids).slice(-MAX_SEEN_ORDERS)
    localStorage.setItem(SEEN_ORDERS_KEY, JSON.stringify(list))
  } catch {}
}

/** The admin orders table/tiles view. Used by the page, by loading.tsx (placeholder rows) and while the filters reload. */
export function OrdersTable({
  orders,
  total,
  page = 1,
  pageSize = 20,
}: {
  orders: Order[]
  total?: number
  page?: number
  pageSize?: number
}) {
  const [viewMode, setViewMode] = useState<"tiles" | "table">("table")
  const [seenIds, setSeenIds] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    try {
      localStorage.removeItem("admin_orders_view")
    } catch {}

    const syncSeen = () => {
      setSeenIds(readSeenOrders())
    }
    syncSeen()

    const mql = window.matchMedia("(max-width: 767px)")
    const syncView = () => {
      const isMobile = mql.matches
      const key = isMobile ? "admin_orders_view_mobile" : "admin_orders_view_desktop"
      try {
        const saved = localStorage.getItem(key)
        if (saved === "table" || saved === "tiles") {
          setViewMode(saved)
          return
        }
      } catch {}
      // Default: mobile = tiles, web = list (table)
      setViewMode(isMobile ? "tiles" : "table")
    }

    syncView()
    mql.addEventListener("change", syncView)
    window.addEventListener("focus", syncSeen)
    window.addEventListener("storage", syncSeen)
    return () => {
      mql.removeEventListener("change", syncView)
      window.removeEventListener("focus", syncSeen)
      window.removeEventListener("storage", syncSeen)
    }
  }, [])

  const markSeen = (orderId: string) => {
    setSeenIds((prev) => {
      if (prev.has(orderId)) return prev
      const next = new Set(prev)
      next.add(orderId)
      writeSeenOrders(next)
      return next
    })
  }

  const isNewOrder = (o: Order) => o.status === "pending" && !seenIds.has(o.id)

  const changeView = (mode: "tiles" | "table") => {
    setViewMode(mode)
    try {
      const isMobile = window.matchMedia("(max-width: 767px)").matches
      const key = isMobile ? "admin_orders_view_mobile" : "admin_orders_view_desktop"
      localStorage.setItem(key, mode)
    } catch {}
  }

  if (orders.length === 0) {
    return (
      <div className={cn("adminCard", styles.emptyCard)}>
        <p className={styles.emptyText}>No orders match these filters.</p>
      </div>
    )
  }

  return (
    <div className={styles.ordersTableRoot}>
      {/* View Switcher Bar */}
      <div className={styles.switcherBar}>
        <span className={styles.showingLabel}>
          {total && total > orders.length
            ? `Showing ${(page - 1) * pageSize + 1}–${(page - 1) * pageSize + orders.length} of ${total} orders`
            : `Showing ${orders.length} order${orders.length === 1 ? "" : "s"}`}
        </span>
        <SegmentedTabs
          layout="inline"
          size="sm"
          ariaLabel="View format"
          value={viewMode}
          onChange={changeView}
          items={[
            { value: "table", label: "List", icon: ListIcon, ariaLabel: "List view" },
            { value: "tiles", label: "Tiles", icon: LayoutGridIcon, ariaLabel: "Tile view" },
          ]}
        />
      </div>

      {viewMode === "tiles" ? (
        <div className={styles.ordersTilesGrid}>
          {orders.map((o) => {
            const isNew = isNewOrder(o)
            return (
              <div
                key={o.id}

                className={cn("adminCardInteractive", styles.orderTile, isNew && styles.orderTileNew)}
              >
                <div className={styles.tileContent}>
                  {/* Header: Code, Placed date */}
                  <div className={styles.tileHeader}>
                    <div>
                      <div className={styles.codeRow}>
                        <Link
                          href={`/admin/orders/${encodeURIComponent(o.orderCode)}`}
                          onClick={() => markSeen(o.id)}
                          className={styles.orderCodeLink}
                        >
                          {o.orderCode}
                        </Link>
                        {isNew && (
                          <span

                            className={styles.newBadge}
                            title="New order — open to review"
                          >
                            <span className={styles.pulseDot} aria-hidden />
                            New
                          </span>
                        )}
                      </div>
                      <div className={styles.placedTime}>
                        Placed {formatDateTime(o.createdAt)}
                      </div>
                    </div>
                    <div className={styles.totalBox}>
                      <span className={styles.totalLabel}>Total</span>
                      <div className={styles.totalAmount}>{formatPrice(o.total)}</div>
                    </div>
                  </div>

                  {/* Status & Payment badges + Last updated status date */}
                  <div className={styles.statusBox}>
                    <div className={styles.badgesRow}>
                      <OrderStatusBadge status={o.status} returnStage={o.returnStage} paymentStatus={o.paymentStatus} audience="admin" />
                      <PaymentBadge status={o.paymentStatus} orderStatus={o.status} refundedAmount={o.refundedAmount} paidAmount={o.paymentAmount ?? o.total} />
                    </div>
                    <ActorMetaLine tag={getStatusActorTag(o)} />
                    <div className={styles.updatedLine}>
                      <ClockIcon className={styles.iconXs} />
                      <span>Status updated:</span>
                      <span className={styles.updatedTime}>{formatDateTime(o.updatedAt)}</span>
                    </div>
                  </div>

                  {/* Customer info */}
                  <div className={styles.customerBox}>
                    <div className={styles.customerName}>{o.customerName}</div>
                    <div className={styles.customerSub}>{o.phone} · {o.city}</div>
                  </div>

                  {/* Products in this order */}
                  <div className={styles.productsBox}>
                    <div className={styles.productsBoxHeader}>
                      <span className={styles.productsTitle}>
                        <PackageIcon className={styles.primaryIcon} />
                        <span>Products ({o.items.reduce((n, i) => n + i.quantity, 0)})</span>
                      </span>
                    </div>
                    <ul className={styles.productsList}>
                      {o.items.map((item, idx) => (
                        <li key={idx} className={styles.productItem}>
                          <span className={styles.itemName} title={item.name}>
                            {item.name}
                          </span>
                          <span className={styles.itemQty}>
                            ×{item.quantity}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Card Footer: View order link */}
                <div className={styles.tileFooter}>
                  <Link
                    href={`/admin/orders/${encodeURIComponent(o.orderCode)}`}
                    onClick={() => markSeen(o.id)}
                    className={styles.manageLink}
                  >
                    Manage order <ArrowRightIcon className={styles.iconSm} />
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div

          tabIndex={0}
          role="region"
          aria-label="Orders table"
          className={cn("adminCard", styles.tableCard)}
        >
          <Table>
            <TableHeader className={styles.tableHeaderSticky}>
              <TableRow>
                <TableHead className={styles.cellPl}>Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead className={styles.cellHiddenMd}>Products</TableHead>
                <TableHead>Status & Updated</TableHead>
                <TableHead className={styles.cellHiddenLg}>Payment</TableHead>
                <TableHead className={styles.cellRight}>Total</TableHead>
                <TableHead className={styles.cellPlacedHead}>Placed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((o) => {
                const isNew = isNewOrder(o)
                return (
                  <TableRow key={o.id} className={cn(styles.tableRow, isNew && styles.tableRowNew)}>
                    <TableCell className={styles.cellPl}>
                      <div className={styles.codeCellWrap}>
                        <Link

                          href={`/admin/orders/${encodeURIComponent(o.orderCode)}`}
                          onClick={() => markSeen(o.id)}
                          className={styles.tableCodeLink}
                        >
                          {o.orderCode}
                        </Link>
                        {isNew && (
                          <span

                            className={styles.newBadge}
                            title="New order — open to review"
                          >
                            <span className={styles.pulseDot} aria-hidden />
                            New
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className={styles.cellCustomerName}>{o.customerName}</div>
                      <div className={styles.cellCustomerSub}>
                        {o.phone} · {o.city}
                      </div>
                    </TableCell>
                    <TableCell className={styles.cellProducts}>
                      <div className={styles.cellProductsStack}>
                        {o.items.map((i, idx) => (
                          <div key={idx} className={styles.cellProductLine} title={`${i.name} (×${i.quantity})`}>
                            <span className={styles.cellProductName}>{i.name}</span> <span className={styles.cellProductQty}>×{i.quantity}</span>
                          </div>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className={styles.cellStatusWrap}>
                        <OrderStatusBadge status={o.status} returnStage={o.returnStage} paymentStatus={o.paymentStatus} audience="admin" />
                        <ActorMetaLine tag={getStatusActorTag(o)} />
                        <span className={styles.cellUpdatedSub}>Updated {formatDateTime(o.updatedAt)}</span>
                      </div>
                    </TableCell>
                    <TableCell className={styles.cellHiddenLg}>
                      <PaymentBadge status={o.paymentStatus} orderStatus={o.status} refundedAmount={o.refundedAmount} paidAmount={o.paymentAmount ?? o.total} />
                    </TableCell>
                    <TableCell className={styles.cellTotal}>{formatPrice(o.total)}</TableCell>
                    <TableCell className={styles.cellPlaced}>
                      {formatDateTime(o.createdAt)}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
