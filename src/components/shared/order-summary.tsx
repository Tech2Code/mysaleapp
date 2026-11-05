import { CreditCardIcon } from "lucide-react"
import Link from "next/link"
import { ProductImage } from "@/components/store/product-image"
import { paymentDisplay, type OrderItem, type OrderPayment, type OrderPricing, type OrderStatus } from "@/features/orders/types"
import { formatPrice } from "@/lib/format"
import { cn } from "@/lib/utils"
import { PAYMENT_TONE_STYLE } from "./payment-badge"
import { PriceBreakdown } from "./price-breakdown"

export type OrderSummaryData = OrderPricing & OrderPayment & { items: OrderItem[]; status: OrderStatus }

/**
 * What was ordered, what it cost, and how it's being paid.
 * Shared by the customer's order page, the track page and the admin order page.
 */
export function OrderSummary({
  order,
  bare = false,
  openLinksInNewTab = false,
  className,
}: {
  order: OrderSummaryData
  /** Render without its own card border (when already inside a card). */
  bare?: boolean
  openLinksInNewTab?: boolean
  className?: string
}) {
  const display = paymentDisplay(order.status, order.paymentStatus, order.paymentMethod)
  const pay = PAYMENT_TONE_STYLE[display.tone]
  const PayIcon = pay.icon
  const linkProps = openLinksInNewTab ? { target: "_blank", rel: "noopener noreferrer" } : {}

  return (
    <section data-ui="shared/OrderSummary"
      aria-labelledby="order-summary-title"
      className={cn(!bare && "rounded-3xl border bg-card p-5 sm:p-6", bare && "border-t pt-5", className)}
    >
      <h3 id="order-summary-title" className="font-sans text-lg font-semibold">
        Order summary
      </h3>

      <ul className="mt-4 divide-y">
        {order.items.map((item) => (
          <li key={item.productId} className="flex gap-3 py-3 first:pt-0">
            <Link
              href={`/products/${item.slug}`}
              {...linkProps}
              className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-muted @container"
            >
              <ProductImage src={item.image} alt={item.name} sizes="64px" />
            </Link>
            <div className="min-w-0 flex-1">
              <Link href={`/products/${item.slug}`} {...linkProps} className="line-clamp-2 text-sm font-semibold hover:text-primary">
                {item.name}
              </Link>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {formatPrice(item.price)} × {item.quantity}
              </p>
            </div>
            <p className="text-sm font-semibold">{formatPrice(item.price * item.quantity)}</p>
          </li>
        ))}
      </ul>

      <PriceBreakdown
        subtotal={order.subtotal}
        shippingFee={order.shippingFee}
        shippingFeeOriginal={order.shippingFeeOriginal}
        extraFees={order.extraFees}
        total={order.total}
        totalLabel="Total paid / payable"
        className="mt-2 border-t pt-4"
      />

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-muted/60 p-3 text-sm">
        <span className="flex items-center gap-2 text-muted-foreground">
          <CreditCardIcon className="size-4" aria-hidden /> Payment
        </span>
        <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", pay.className)}>
          <PayIcon className="size-3.5" aria-hidden />
          {display.label}
        </span>
      </div>
      {order.status !== "cancelled" && (order.paymentStatus === "pending" || order.paymentStatus === "failed") && (
        <p className="mt-2 text-xs text-muted-foreground">
          Your order is confirmed after the payment is verified. Cash on delivery isn&apos;t available.
        </p>
      )}
    </section>
  )
}
