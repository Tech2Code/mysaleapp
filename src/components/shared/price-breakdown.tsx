import { InfoIcon } from "lucide-react"
import type { OrderFee } from "@/features/orders/types"
import { formatPrice } from "@/lib/format"
import { cn } from "@/lib/utils"

type Breakdown = {
  subtotal: number
  shippingFee: number
  shippingFeeOriginal: number
  extraFees: OrderFee[]
  total: number
}

/**
 * Items, product charges (each shown with the product it belongs to and why it applies),
 * delivery (struck through + "FREE" when waived) and the final total.
 * Works with both a live cart (`calculateCharges`) and a saved order.
 */
export function PriceBreakdown({
  subtotal,
  shippingFee,
  shippingFeeOriginal,
  extraFees,
  total,
  totalLabel = "Total",
  className,
}: Breakdown & { totalLabel?: string; className?: string }) {
  const deliveryFree = shippingFee === 0
  const saved = deliveryFree ? shippingFeeOriginal : 0

  return (
    <div data-ui="shared/PriceBreakdown" className={cn("space-y-3 text-sm", className)}>
      <dl className="space-y-2">
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Items total</dt>
          <dd className="font-medium">{formatPrice(subtotal)}</dd>
        </div>
      </dl>

      {extraFees.length > 0 && (
        <section aria-label="Product charges" className="space-y-2.5 rounded-xl bg-muted/60 p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            <InfoIcon className="size-3.5" aria-hidden /> Product charges · added once per product
          </p>
          <ul className="space-y-2.5">
            {extraFees.map((fee, i) => (
              <li key={`${fee.productId ?? fee.productName ?? ""}-${fee.label}-${i}`} className="flex justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-medium">{fee.label}</p>
                  {fee.productName && <p className="truncate text-xs text-muted-foreground">for {fee.productName}</p>}
                  {fee.reason && <p className="mt-0.5 text-xs text-muted-foreground italic">{fee.reason}</p>}
                </div>
                <p className="shrink-0 font-medium">{formatPrice(fee.amount)}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <dl className="space-y-2">
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Delivery</dt>
          <dd className="flex items-baseline gap-2 font-medium">
            {deliveryFree ? (
              <>
                {saved > 0 && <s className="text-muted-foreground">{formatPrice(saved)}</s>}
                <span className="font-semibold text-success">FREE</span>
              </>
            ) : (
              formatPrice(shippingFee)
            )}
          </dd>
        </div>

        {saved > 0 && <p className="text-xs font-medium text-success">You saved {formatPrice(saved)} on delivery 🎉</p>}

        <div className="flex items-baseline justify-between gap-4 border-t pt-3">
          <dt className="font-semibold">{totalLabel}</dt>
          <dd className="font-heading text-2xl font-semibold">{formatPrice(total)}</dd>
        </div>
      </dl>
    </div>
  )
}
