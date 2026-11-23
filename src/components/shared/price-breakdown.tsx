import { SparklesIcon } from "lucide-react"
import type { OrderFee } from "@/features/orders/types"
import { formatPrice } from "@/lib/format"
import { cn } from "@/lib/utils"

type Breakdown = {
  subtotal: number
  shippingFee: number
  shippingFeeOriginal: number
  extraFees: OrderFee[]
  promoCode?: string | null
  discountAmount?: number
  total: number
}

/**
 * Items, product charges (each shown with the product it belongs to and why it applies),
 * promo code discount, delivery (struck through + "FREE" when waived) and the final total.
 * Works with both a live cart (`calculateCharges`) and a saved order.
 */
export function PriceBreakdown({
  subtotal,
  shippingFee,
  shippingFeeOriginal,
  extraFees,
  promoCode,
  discountAmount = 0,
  total,
  totalLabel = "Total",
  itemCount,
  className,
}: Breakdown & { totalLabel?: string; itemCount?: number; className?: string }) {
  const deliveryFree = shippingFee === 0
  const saved = deliveryFree ? shippingFeeOriginal : 0
  const promoSaved = discountAmount > 0 ? discountAmount : 0
  const totalSaved = saved + promoSaved

  return (
    <div data-ui="shared/PriceBreakdown" className={cn("space-y-3 text-sm", className)}>
      <dl data-ui="shared/PriceBreakdown/dl" className="space-y-2">
        <div data-ui="shared/PriceBreakdown/div-flex" className="flex justify-between gap-4">
          <dt data-ui="shared/PriceBreakdown/dt" className="text-muted-foreground">Items total{itemCount ? ` (${itemCount} ${itemCount === 1 ? "item" : "items"})` : ""}</dt>
          <dd data-ui="shared/PriceBreakdown/dd" className="font-medium">{formatPrice(subtotal)}</dd>
        </div>
        {promoSaved > 0 && (
          <div data-ui="shared/PriceBreakdown/div-flex-2" className="flex justify-between gap-4 text-success">
            <dt data-ui="shared/PriceBreakdown/dt-flex" className="flex items-center gap-1.5 font-medium">
              <span data-ui="shared/PriceBreakdown/span">Promo discount</span>
              {promoCode && (
                <span data-ui="shared/PriceBreakdown/span-2" className="rounded bg-success/12 px-1.5 py-0.5 font-mono text-[11px] font-bold tracking-wider uppercase">
                  {promoCode}
                </span>
              )}
            </dt>
            <dd data-ui="shared/PriceBreakdown/dd-2" className="font-semibold tabular-nums">-{formatPrice(promoSaved)}</dd>
          </div>
        )}
      </dl>

      {extraFees.length > 0 && (
        <section data-ui="shared/PriceBreakdown/section-product-charges" aria-label="Product charges" className="space-y-1.5 rounded-lg bg-muted/40 p-2.5 text-xs">
          <ul data-ui="shared/PriceBreakdown/ul" className="space-y-1.5">
            {extraFees.map((fee, i) => (
              <li
                data-ui="shared/PriceBreakdown/li-flex"
                key={`${fee.productId ?? fee.productName ?? ""}-${fee.label}-${i}`}
                title={fee.reason ?? undefined}
                className="flex items-start justify-between gap-2"
              >
                <span data-ui="shared/PriceBreakdown/span-3" className="min-w-0 text-muted-foreground">
                  <span data-ui="shared/PriceBreakdown/span-4" className="block truncate">
                    {fee.label}
                    {fee.productName && <span data-ui="shared/PriceBreakdown/span-5" className="text-[11px] opacity-80"> · {fee.productName}</span>}
                  </span>
                  {fee.reason && <span data-ui="shared/PriceBreakdown/span-6" className="block text-[11px] opacity-75">{fee.reason}</span>}
                </span>
                <span data-ui="shared/PriceBreakdown/span-7" className="font-medium shrink-0">{formatPrice(fee.amount)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <dl data-ui="shared/PriceBreakdown/dl-2" className="space-y-2">
        <div data-ui="shared/PriceBreakdown/div-flex-3" className="flex justify-between gap-4">
          <dt data-ui="shared/PriceBreakdown/dt-2" className="text-muted-foreground">Delivery</dt>
          <dd data-ui="shared/PriceBreakdown/dd-flex" className="flex items-baseline gap-2 font-medium">
            {deliveryFree ? (
              <>
                {saved > 0 && <s data-ui="shared/PriceBreakdown/s" className="text-muted-foreground">{formatPrice(saved)}</s>}
                <span data-ui="shared/PriceBreakdown/span-8" className="font-semibold text-success">FREE</span>
              </>
            ) : (
              formatPrice(shippingFee)
            )}
          </dd>
        </div>

        {totalSaved > 0 && (
          <p data-ui="shared/PriceBreakdown/p-inline-flex" className="inline-flex items-center gap-1.5 text-xs font-medium text-success">
            <SparklesIcon className="size-3.5 shrink-0" aria-hidden />
            <span data-ui="shared/PriceBreakdown/span-9">You saved {formatPrice(totalSaved)} on this order</span>
          </p>
        )}

        <div data-ui="shared/PriceBreakdown/div-flex-4" className="flex items-baseline justify-between gap-4 border-t pt-3">
          <dt data-ui="shared/PriceBreakdown/dt-3" className="font-semibold">{totalLabel}</dt>
          <dd data-ui="shared/PriceBreakdown/dd-3" className="font-heading text-2xl font-semibold">{formatPrice(total)}</dd>
        </div>
      </dl>
    </div>
  )
}
