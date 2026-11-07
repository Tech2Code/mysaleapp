import Link from "next/link"
import { PaymentBadge } from "@/components/shared/payment-badge"
import { ReturnStageBadge } from "@/components/shared/return-stage-badge"
import { StatusBadge } from "@/components/shared/status-badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { Order } from "@/features/orders/types"
import { formatDateTime, formatPrice } from "@/lib/format"

/** The admin orders table. Used by the page, by loading.tsx (placeholder rows) and while the filters reload. */
export function OrdersTable({ orders }: { orders: Order[] }) {
  return (
    <div data-ui="admin/OrdersTable" className="overflow-hidden rounded-2xl border bg-card">
      {orders.length === 0 ? (
        <p data-ui="admin/OrdersTable/p" className="p-8 sm:p-12 text-center text-sm text-muted-foreground">No orders match these filters.</p>
      ) : (
        <Table data-ui="admin/OrdersTable/Table">
          <TableHeader data-ui="admin/OrdersTable/TableHeader">
            <TableRow data-ui="admin/OrdersTable/TableRow">
              <TableHead data-ui="admin/OrdersTable/TableHead-order" className="pl-5">Order</TableHead>
              <TableHead data-ui="admin/OrdersTable/TableHead-customer">Customer</TableHead>
              <TableHead data-ui="admin/OrdersTable/TableHead-items" className="hidden md:table-cell">Items</TableHead>
              <TableHead data-ui="admin/OrdersTable/TableHead-status">Status</TableHead>
              <TableHead data-ui="admin/OrdersTable/TableHead-payment" className="hidden lg:table-cell">Payment</TableHead>
              <TableHead data-ui="admin/OrdersTable/TableHead-total" className="text-right">Total</TableHead>
              <TableHead data-ui="admin/OrdersTable/TableHead-placed" className="hidden pr-5 text-right sm:table-cell">Placed</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody data-ui="admin/OrdersTable/TableBody">
            {orders.map((o) => (
              <TableRow data-ui="admin/OrdersTable/TableRow-2" key={o.id} className="group">
                <TableCell data-ui="admin/OrdersTable/TableCell" className="pl-5">
                  <Link data-ui="admin/OrdersTable/Link" href={`/admin/orders/${o.id}`} className="font-mono font-semibold text-primary group-hover:underline">
                    {o.orderCode}
                  </Link>
                </TableCell>
                <TableCell data-ui="admin/OrdersTable/TableCell-2">
                  <div data-ui="admin/OrdersTable/div" className="font-medium">{o.customerName}</div>
                  <div data-ui="admin/OrdersTable/div-2" className="text-xs text-muted-foreground">
                    {o.phone} · {o.city}
                  </div>
                </TableCell>
                <TableCell data-ui="admin/OrdersTable/TableCell-hidden" className="hidden max-w-64 truncate text-sm text-muted-foreground md:table-cell">
                  {o.items.reduce((n, i) => n + i.quantity, 0)} × {o.items.map((i) => i.name).join(", ")}
                </TableCell>
                <TableCell data-ui="admin/OrdersTable/TableCell-3">
                  <div data-ui="admin/OrdersTable/div-flex" className="flex flex-col items-start gap-1">
                    <StatusBadge status={o.status} />
                    <ReturnStageBadge stage={o.returnStage} audience="admin" />
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
      )}
    </div>
  )
}
