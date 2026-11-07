import { InfoIcon, WalletIcon } from "lucide-react"
import { refundBreakdown } from "@/features/orders/refund"
import type { OrderFee, OrderItem, OrderReturn, ReturnRequest } from "@/features/orders/types"
import { formatPrice } from "@/lib/format"

/**
 * "How much will I get back?" for an order with a return, for customers, guests and the admin:
 * what was paid, the refund per returned item, what is NOT refunded (delivery and other charges) and
 * the amount that goes back. Items only: charges are never refunded.
 */
export function RefundSummary({
  order,
}: {
  order: {
    items: OrderItem[]
    returnRequests: ReturnRequest[]
    returns: OrderReturn[]
    shippingFee: number
    extraFees: OrderFee[]
    total: number
    paymentAmount: number | null
    refundedAmount: number
  }
}) {
  const b = refundBreakdown(order)
  if (!b) return null
  const done = b.basis === "returned"

  return (
    <section data-ui="shared/RefundSummary" aria-label="Refund details" className="space-y-3 rounded-2xl border bg-card p-4 sm:p-5">
      <h3 data-ui="shared/RefundSummary/h3-refund-details" className="flex items-center gap-2 font-sans text-base font-semibold">
        <WalletIcon className="size-4 text-primary" aria-hidden /> Refund details
      </h3>
      <p data-ui="shared/RefundSummary/p-flex" className="flex items-baseline justify-between gap-3 text-sm">
        <span data-ui="shared/RefundSummary/span" className="text-muted-foreground">Order total paid</span>
        <span data-ui="shared/RefundSummary/span-2" className="font-medium">{formatPrice(b.paid)}</span>
      </p>

      <div data-ui="shared/RefundSummary/div" className="space-y-1.5 border-t pt-3">
        <p data-ui="shared/RefundSummary/p" className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {done ? "Items returned" : "Items you are returning"}
        </p>
        <ul data-ui="shared/RefundSummary/ul" className="space-y-1.5 text-sm">
          {b.lines.map((l) => (
            <li data-ui="shared/RefundSummary/li-flex" key={l.productId} className="flex items-baseline justify-between gap-3">
              <span data-ui="shared/RefundSummary/span-3" className="min-w-0">
                {l.name} <span data-ui="shared/RefundSummary/span-4" className="text-muted-foreground">({l.quantity} × {formatPrice(l.unitPrice)})</span>
              </span>
              <span data-ui="shared/RefundSummary/span-5" className="shrink-0 font-medium">{formatPrice(l.amount)}</span>
            </li>
          ))}
        </ul>
      </div>

      {b.notRefunded.length > 0 && (
        <div data-ui="shared/RefundSummary/div-2" className="space-y-1.5 border-t pt-3">
          <p data-ui="shared/RefundSummary/p-2" className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Not refunded</p>
          <ul data-ui="shared/RefundSummary/ul-2" className="space-y-1.5 text-sm">
            {b.notRefunded.map((c, i) => (
              <li data-ui="shared/RefundSummary/li-flex-2" key={`${c.label}-${i}`} className="flex items-baseline justify-between gap-3 text-muted-foreground">
                <span data-ui="shared/RefundSummary/span-6" className="min-w-0">{c.label}</span>
                <span data-ui="shared/RefundSummary/span-7" className="shrink-0">{formatPrice(c.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p data-ui="shared/RefundSummary/p-flex-2" className="flex items-baseline justify-between gap-3 border-t pt-3 text-base font-semibold">
        <span data-ui="shared/RefundSummary/span-8">{done ? "Refund for these items" : "You get back"}</span>
        <span data-ui="shared/RefundSummary/span-9">{formatPrice(b.refundable)}</span>
      </p>
      {b.alreadyRefunded > 0 && (
        <p data-ui="shared/RefundSummary/p-flex-3" className="flex items-baseline justify-between gap-3 text-sm font-medium text-success">
          <span data-ui="shared/RefundSummary/span-10">Already refunded</span>
          <span data-ui="shared/RefundSummary/span-11">{formatPrice(b.alreadyRefunded)}</span>
        </p>
      )}
      <p data-ui="shared/RefundSummary/p-flex-4" className="flex items-start gap-1.5 text-xs text-muted-foreground">
        <InfoIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <span data-ui="shared/RefundSummary/span-12">A return refunds only the price of the returned items. Delivery and other charges are not refunded.</span>
      </p>
    </section>
  )
}
