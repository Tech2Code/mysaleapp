"use client"

import { ArrowRightIcon, ClockIcon, LayoutGridIcon, ListIcon, PackageIcon } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { OrderStatusBadge } from "@/components/shared/order-status-badge"
import { PaymentBadge } from "@/components/shared/payment-badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { Order } from "@/features/orders/types"
import { formatDateTime, formatPrice } from "@/lib/format"
import { cn } from "@/lib/utils"

/** The admin orders table/tiles view. Used by the page, by loading.tsx (placeholder rows) and while the filters reload. */
export function OrdersTable({ orders }: { orders: Order[] }) {
  const [viewMode, setViewMode] = useState<"tiles" | "table">("table")

  useEffect(() => {
    try {
      localStorage.removeItem("admin_orders_view")
    } catch {}

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
    return () => mql.removeEventListener("change", syncView)
  }, [])

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
      <div data-ui="admin/OrdersTable" className="overflow-hidden rounded-2xl border bg-card p-8 text-center sm:p-12">
        <p data-ui="admin/OrdersTable/p" className="text-sm text-muted-foreground">No orders match these filters.</p>
      </div>
    )
  }

  return (
    <div data-ui="admin/OrdersTable" className="space-y-3">
      {/* View Switcher Bar */}
      <div className="flex items-center justify-between gap-3 px-1">
        <span className="text-xs font-medium text-muted-foreground">
          Showing {orders.length} order{orders.length === 1 ? "" : "s"}
        </span>
        <div className="flex items-center rounded-full border bg-muted/40 p-1 text-xs font-medium" role="group" aria-label="View format">
          <button
            type="button"
            onClick={() => changeView("table")}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors cursor-pointer",
              viewMode === "table" ? "bg-background text-foreground shadow-xs font-semibold" : "text-muted-foreground hover:text-foreground"
            )}
            aria-pressed={viewMode === "table"}
            aria-label="List view"
          >
            <ListIcon className="size-3.5" />
            <span>List</span>
          </button>
          <button
            type="button"
            onClick={() => changeView("tiles")}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors cursor-pointer",
              viewMode === "tiles" ? "bg-background text-foreground shadow-xs font-semibold" : "text-muted-foreground hover:text-foreground"
            )}
            aria-pressed={viewMode === "tiles"}
            aria-label="Tile view"
          >
            <LayoutGridIcon className="size-3.5" />
            <span>Tiles</span>
          </button>
        </div>
      </div>

      {viewMode === "tiles" ? (
        <div data-ui="admin/OrdersTable/tiles" className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {orders.map((o) => (
            <div
              key={o.id}
              data-ui="admin/OrdersTable/tile-card"
              className="group flex flex-col justify-between rounded-2xl border bg-card p-4 transition-all duration-200 hover:border-ring/40 hover:shadow-md"
            >
              <div className="space-y-3">
                {/* Header: Code, Placed date */}
                <div className="flex items-start justify-between gap-2 border-b pb-3">
                  <div>
                    <Link
                      href={`/admin/orders/${o.id}`}
                      prefetch={true}
                      className="font-mono text-base font-bold text-primary hover:underline"
                    >
                      {o.orderCode}
                    </Link>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      Placed {formatDateTime(o.createdAt)}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-muted-foreground">Total</span>
                    <div className="text-base font-bold text-foreground">{formatPrice(o.total)}</div>
                  </div>
                </div>

                {/* Status & Payment badges + Last updated status date */}
                <div className="space-y-2 rounded-xl bg-muted/30 p-2.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <OrderStatusBadge status={o.status} returnStage={o.returnStage} paymentStatus={o.paymentStatus} audience="admin" />
                    <PaymentBadge status={o.paymentStatus} orderStatus={o.status} refundedAmount={o.refundedAmount} paidAmount={o.paymentAmount ?? o.total} />
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <ClockIcon className="size-3 shrink-0" />
                    <span>Status updated:</span>
                    <span className="font-medium text-foreground">{formatDateTime(o.updatedAt)}</span>
                  </div>
                </div>

                {/* Customer info */}
                <div className="text-xs space-y-0.5">
                  <div className="font-semibold text-foreground text-sm">{o.customerName}</div>
                  <div className="text-muted-foreground">{o.phone} · {o.city}</div>
                </div>

                {/* Products in this order */}
                <div className="rounded-xl border bg-muted/20 p-3 space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <PackageIcon className="size-3.5 text-primary" />
                      <span>Products ({o.items.reduce((n, i) => n + i.quantity, 0)})</span>
                    </span>
                  </div>
                  <ul className="space-y-1 divide-y divide-border/30">
                    {o.items.map((item, idx) => (
                      <li key={idx} className="flex items-center justify-between gap-2 pt-1 first:pt-0">
                        <span className="truncate text-xs font-medium text-foreground" title={item.name}>
                          {item.name}
                        </span>
                        <span className="shrink-0 font-mono text-xs font-semibold text-muted-foreground">
                          ×{item.quantity}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Card Footer: View order link */}
              <div className="mt-4 pt-3 border-t flex items-center justify-end">
                <Link
                  href={`/admin/orders/${o.id}`}
                  prefetch={true}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                >
                  Manage order <ArrowRightIcon className="size-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div data-ui="admin/OrdersTable/table-container" className="overflow-hidden rounded-2xl border bg-card">
          <Table data-ui="admin/OrdersTable/Table">
            <TableHeader data-ui="admin/OrdersTable/TableHeader">
              <TableRow data-ui="admin/OrdersTable/TableRow">
                <TableHead data-ui="admin/OrdersTable/TableHead-order" className="pl-5">Order</TableHead>
                <TableHead data-ui="admin/OrdersTable/TableHead-customer">Customer</TableHead>
                <TableHead data-ui="admin/OrdersTable/TableHead-items" className="hidden md:table-cell">Products</TableHead>
                <TableHead data-ui="admin/OrdersTable/TableHead-status">Status & Updated</TableHead>
                <TableHead data-ui="admin/OrdersTable/TableHead-payment" className="hidden lg:table-cell">Payment</TableHead>
                <TableHead data-ui="admin/OrdersTable/TableHead-total" className="text-right">Total</TableHead>
                <TableHead data-ui="admin/OrdersTable/TableHead-placed" className="hidden pr-5 text-right sm:table-cell">Placed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody data-ui="admin/OrdersTable/TableBody">
              {orders.map((o) => (
                <TableRow data-ui="admin/OrdersTable/TableRow-2" key={o.id} className="group">
                  <TableCell data-ui="admin/OrdersTable/TableCell" className="pl-5">
                    <Link data-ui="admin/OrdersTable/Link" href={`/admin/orders/${o.id}`} prefetch={true} className="font-mono font-semibold text-primary group-hover:underline">
                      {o.orderCode}
                    </Link>
                  </TableCell>
                  <TableCell data-ui="admin/OrdersTable/TableCell-2">
                    <div data-ui="admin/OrdersTable/div" className="font-medium">{o.customerName}</div>
                    <div data-ui="admin/OrdersTable/div-2" className="text-xs text-muted-foreground">
                      {o.phone} · {o.city}
                    </div>
                  </TableCell>
                  <TableCell data-ui="admin/OrdersTable/TableCell-hidden" className="hidden max-w-72 text-sm md:table-cell">
                    <div className="flex flex-col gap-0.5">
                      {o.items.map((i, idx) => (
                        <div key={idx} className="truncate text-xs text-muted-foreground font-medium" title={`${i.name} (×${i.quantity})`}>
                          <span className="text-foreground">{i.name}</span> <span className="font-mono font-semibold">×{i.quantity}</span>
                        </div>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell data-ui="admin/OrdersTable/TableCell-3">
                    <div data-ui="admin/OrdersTable/div-flex" className="flex flex-col items-start gap-1">
                      <OrderStatusBadge status={o.status} returnStage={o.returnStage} paymentStatus={o.paymentStatus} audience="admin" />
                      <span className="text-[11px] text-muted-foreground">Updated {formatDateTime(o.updatedAt)}</span>
                    </div>
                  </TableCell>
                  <TableCell data-ui="admin/OrdersTable/TableCell-hidden-2" className="hidden lg:table-cell">
                    <PaymentBadge status={o.paymentStatus} orderStatus={o.status} refundedAmount={o.refundedAmount} paidAmount={o.paymentAmount ?? o.total} />
                  </TableCell>
                  <TableCell data-ui="admin/OrdersTable/TableCell-4" className="text-right font-semibold">{formatPrice(o.total)}</TableCell>
                  <TableCell data-ui="admin/OrdersTable/TableCell-hidden-3" className="hidden pr-5 text-right text-xs text-muted-foreground sm:table-cell">
                    {formatDateTime(o.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
