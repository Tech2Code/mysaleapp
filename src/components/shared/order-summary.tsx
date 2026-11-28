import { CreditCardIcon } from "lucide-react"
import Link from "next/link"
import { OrderItemReviewWidget } from "@/components/store/product-actions"
import { ProductImage } from "@/components/store/product-image"
import { isAwaitingPayment, paymentDisplay, type OrderItem, type OrderPayment, type OrderPricing, type OrderStatus } from "@/features/orders/types"
import { formatPrice } from "@/lib/format"
import { cn } from "@/lib/utils"
import { PAYMENT_TONE_STYLE } from "./payment-badge"
import { PriceBreakdown } from "./price-breakdown"
import styles from "./shared.module.css"

export type OrderSummaryData = OrderPricing & OrderPayment & { items: OrderItem[]; status: OrderStatus }

/**
 * What was ordered, what it cost, and how it's being paid.
 * Shared by the customer's order page, the track page and the admin order page.
 */
export function OrderSummary({
  order,
  bare = false,
  openLinksInNewTab = false,
  audience = "customer",
  className,
}: {
  order: OrderSummaryData
  /** Render without its own card border (when already inside a card). */
  bare?: boolean
  openLinksInNewTab?: boolean
  /** The "confirmed after payment" hint is for customers only. */
  audience?: "customer" | "admin"
  className?: string
}) {
  const itemCount = order.items.reduce((n, i) => n + i.quantity, 0)
  const display = paymentDisplay(order.status, order.paymentStatus, order.paymentMethod, {
    refundedAmount: order.refundedAmount,
    paidAmount: order.paymentAmount ?? order.total,
  })
  const pay = PAYMENT_TONE_STYLE[display.tone]
  const PayIcon = pay.icon
  const linkProps = openLinksInNewTab ? { target: "_blank", rel: "noopener noreferrer" } : {}

  return (
    <section
      aria-labelledby="order-summary-title"
      className={cn(!bare && styles.orderSummaryCard, bare && styles.orderSummaryBare, className)}
    >
      <h3 id="order-summary-title" className={styles.summaryTitleRow}>
        Order summary
        <span className={styles.summaryCountSpan}>
          {itemCount} item{itemCount === 1 ? "" : "s"}
        </span>
      </h3>

      <ul className={styles.summaryItemsUl}>
        {order.items.map((item) => {
          const suffix = item.variantLabel ? ` — ${item.variantLabel}` : ""
          const cleanName = suffix && item.name.endsWith(suffix) ? item.name.slice(0, -suffix.length) : item.name
          return (
            <li key={item.variantId ? `${item.productId}::${item.variantId}` : item.productId} className={styles.summaryItemLi}>
              <div className={styles.itemFlexRow}>
                <Link
                  href={`/products/${item.slug}`}
                  {...linkProps}
                  className={styles.itemThumbLink}
                >
                  <ProductImage src={item.image} alt={cleanName} sizes="64px" />
                </Link>
                <div className={styles.itemDetailsCol}>
                  <Link href={`/products/${item.slug}`} {...linkProps} className={styles.itemNameLink}>
                    {cleanName}
                  </Link>
                  {(item.variantLabel || (audience === "admin" && item.variantSku)) && (
                    <div className={styles.itemVariantRow}>
                      {item.variantLabel && <span className={styles.itemVariantPill}>{item.variantLabel}</span>}
                      {audience === "admin" && item.variantSku && (
                        <span className={styles.itemSkuTag}>SKU: {item.variantSku}</span>
                      )}
                    </div>
                  )}
                  <p className={styles.itemUnitQty}>
                    {formatPrice(item.price)} × {item.quantity}
                  </p>
                </div>
                <p className={styles.itemLineTotal}>{formatPrice(item.price * item.quantity)}</p>
              </div>
              {audience === "customer" && order.status === "delivered" && !item.productId.startsWith("ph-") && (
                <OrderItemReviewWidget item={item} />
              )}
            </li>
          )
        })}
      </ul>

      <PriceBreakdown
        subtotal={order.subtotal}
        shippingFee={order.shippingFee}
        shippingFeeOriginal={order.shippingFeeOriginal}
        extraFees={order.extraFees}
        promoCode={order.promoCode}
        discountAmount={order.discountAmount}
        total={order.total}
        totalLabel="Total paid / payable"
        className={styles.summaryBreakdownTop}
      />

      <div className={styles.paymentStatusStrip}>
        <span className={styles.paymentLabelLeft}>
          <CreditCardIcon className={styles.icon16} aria-hidden /> Payment
        </span>
        <span className={styles.paymentStatusRight}>
          <span className={cn(styles.paymentTonePill, pay.className)}>
            <PayIcon className={styles.icon14} aria-hidden />
            {display.label}
          </span>
          {display.detail && <span className={styles.paymentBadgeDetail}>{display.detail}</span>}
        </span>
      </div>
      {audience === "customer" && isAwaitingPayment(order) && (
        <p className={styles.awaitingPaymentHint}>
          Your order is confirmed after the payment is verified. Cash on delivery isn&apos;t available.
        </p>
      )}
    </section>
  )
}
