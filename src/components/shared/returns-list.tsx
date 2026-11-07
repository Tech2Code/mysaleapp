import { PackageOpenIcon } from "lucide-react"
import { RefundReturnButton } from "@/components/admin/refund-return-button"
import type { OrderItem, OrderReturn } from "@/features/orders/types"
import { formatDateTime, formatPrice } from "@/lib/format"

/** Item value of one return, priced from the order's lines (what the database refunds for it). */
function returnValue(r: OrderReturn, items: OrderItem[]): number {
  return r.items.reduce((n, i) => n + i.quantity * Math.max(0, ...items.filter((o) => o.productId === i.productId).map((o) => o.price)), 0)
}

/**
 * Goods that came back for an order. The admin also sees whether each item went back into stock;
 * the customer sees what was returned and whether the refund was made.
 */
export function ReturnsList({
  returns,
  audience,
  admin,
  refundedInFull = false,
}: {
  returns: OrderReturn[]
  audience: "customer" | "admin"
  /** Customer view: say "Refund done" only when the whole order is refunded (else "Part refunded"). */
  refundedInFull?: boolean
  /** Admin only: lets a return recorded without a refund be refunded later (the order must still be 'paid'). */
  admin?: { items: OrderItem[]; paymentStatus: string; refundedAmount: number }
}) {
  if (returns.length === 0) return null
  return (
    <section data-ui="shared/ReturnsList" aria-label="Returns" className="space-y-3 rounded-2xl border bg-card p-4 sm:p-5">
      <h3 data-ui="shared/ReturnsList/h3-returns" className="flex items-center gap-2 font-sans text-base font-semibold">
        <PackageOpenIcon className="size-4 text-primary" aria-hidden /> Returns
      </h3>
      <ul data-ui="shared/ReturnsList/ul" className="divide-y">
        {returns.map((r) => (
          <li data-ui="shared/ReturnsList/li" key={r.id} className="space-y-1.5 py-3 first:pt-0 last:pb-0">
            <p data-ui="shared/ReturnsList/p" className="text-xs text-muted-foreground">Received {formatDateTime(r.createdAt)}</p>
            <ul data-ui="shared/ReturnsList/ul-2" className="space-y-1 text-sm">
              {r.items.map((i) => (
                <li data-ui="shared/ReturnsList/li-flex" key={i.productId} className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span data-ui="shared/ReturnsList/span">
                    {i.quantity} × {i.name}
                  </span>
                  {audience === "admin" && (
                    <span data-ui="shared/ReturnsList/span-2" className={i.restock ? "text-xs font-medium text-success" : "text-xs font-medium text-muted-foreground"}>
                      {i.restock ? "Back in stock" : "Not restocked"}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            {r.reason && <p data-ui="shared/ReturnsList/p-2" className="text-sm text-muted-foreground">Reason: {r.reason}</p>}
            {r.refunded ? (
              <p data-ui="shared/ReturnsList/p-3" className="text-sm font-medium text-success">
                {audience === "admin" && r.refundAmount ? `Refunded ${formatPrice(r.refundAmount)}` : refundedInFull ? "Refund done" : "Part refunded"}
              </p>
            ) : (
              audience === "admin" && (
                <div data-ui="shared/ReturnsList/div-flex" className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <p data-ui="shared/ReturnsList/p-4" className="text-sm font-medium text-muted-foreground">No refund recorded</p>
                  {admin && admin.paymentStatus === "paid" && (
                    <RefundReturnButton returnId={r.id} value={returnValue(r, admin.items)} expectedRefunded={admin.refundedAmount} />
                  )}
                </div>
              )
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
