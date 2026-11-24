import { SparklesIcon } from "lucide-react"
import type { OrderFee } from "@/features/orders/types"
import { formatPrice } from "@/lib/format"
import { cn } from "@/lib/utils"
import styles from "./shared.module.css"

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
    <div className={cn(styles.priceBreakdown, className)}>
      <dl className={styles.linesDl}>
        <div className={styles.lineRow}>
          <dt className={styles.mutedDt}>Items total{itemCount ? ` (${itemCount} ${itemCount === 1 ? "item" : "items"})` : ""}</dt>
          <dd className={styles.mediumDd}>{formatPrice(subtotal)}</dd>
        </div>
        {promoSaved > 0 && (
          <div className={styles.promoDiscountRow}>
            <dt className={styles.promoDt}>
              <span>Promo discount</span>
              {promoCode && (
                <span className={styles.promoCodeBadge}>
                  {promoCode}
                </span>
              )}
            </dt>
            <dd className={styles.promoDd}>-{formatPrice(promoSaved)}</dd>
          </div>
        )}
      </dl>

      {extraFees.length > 0 && (
        <section aria-label="Product charges" className={styles.chargesBox}>
          <ul className={styles.chargesUl}>
            {extraFees.map((fee, i) => (
              <li

                key={`${fee.productId ?? fee.productName ?? ""}-${fee.label}-${i}`}
                title={fee.reason ?? undefined}
                className={styles.chargeLi}
              >
                <span className={styles.chargeTextCol}>
                  <span className={styles.chargeLabelTrunc}>
                    {fee.label}
                    {fee.productName && <span className={styles.chargeProdSpan}> · {fee.productName}</span>}
                  </span>
                  {fee.reason && <span className={styles.chargeReasonSpan}>{fee.reason}</span>}
                </span>
                <span className={styles.chargeAmount}>{formatPrice(fee.amount)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <dl className={styles.linesDl}>
        <div className={styles.lineRow}>
          <dt className={styles.mutedDt}>Delivery</dt>
          <dd className={styles.deliveryDd}>
            {deliveryFree ? (
              <>
                {saved > 0 && <s className={styles.struckOriginal}>{formatPrice(saved)}</s>}
                <span className={styles.freeBadgeText}>FREE</span>
              </>
            ) : (
              formatPrice(shippingFee)
            )}
          </dd>
        </div>

        {totalSaved > 0 && (
          <p className={styles.savingsBannerRow}>
            <SparklesIcon className={styles.sparkleSvg} aria-hidden />
            <span>You saved {formatPrice(totalSaved)} on this order</span>
          </p>
        )}

        <div className={styles.grandTotalRow}>
          <dt className={styles.grandTotalDt}>{totalLabel}</dt>
          <dd className={styles.grandTotalDd}>{formatPrice(total)}</dd>
        </div>
      </dl>
    </div>
  )
}
