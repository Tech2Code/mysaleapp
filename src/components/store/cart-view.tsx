"use client"

import { AlertTriangleIcon, ArrowRightIcon, ShoppingBagIcon, Trash2Icon } from "lucide-react"
import { AnimatePresence } from "motion/react"
import * as m from "motion/react-m"
import Link from "next/link"
import { PriceBreakdown } from "@/components/shared/price-breakdown"
import { buttonVariants } from "@/components/ui/button"
import { Skeletonize } from "@/components/shared/skeletonize"
import { calculateCharges, formatWeightGrams } from "@/features/orders/pricing"
import { placeholderCartLines } from "@/features/products/placeholders"
import { formatPrice } from "@/lib/format"
import { cn } from "@/lib/utils"
import { MAX_QTY_PER_ITEM, useCart } from "@/store/cart"
import { FreeShippingBar } from "./cart-drawer"
import styles from "./cart.module.css"
import { useLiveCart, type LiveCartLine, type LiveProduct } from "./live-cart"
import { ProductImage } from "./product-image"
import { QuantityStepper } from "./quantity-stepper"
import { useStoreSettings } from "./store-settings-provider"

/** `preview`: render the placeholder cart as-is; loading.tsx wraps it in <Skeletonize> (the browser cart is not known yet). Before hydration it wraps itself. */
export function CartView({ products, preview = false }: { products: LiveProduct[]; preview?: boolean }) {
  const { ready, lines, hasUnavailable, subtotal, charges } = useLiveCart(products)
  const settings = useStoreSettings()
  const setQuantity = useCart((s) => s.setQuantity)
  const remove = useCart((s) => s.remove)

  if (!ready || preview) {
    const placeholder = placeholderCartLines()
    const layout = <CartLayout lines={placeholder} hasUnavailable={false} subtotal={calculateCharges(placeholder, settings).subtotal} charges={calculateCharges(placeholder, settings)} />
    return preview ? layout : <Skeletonize>{layout}</Skeletonize>
  }

  if (lines.length === 0) {
    return (
      <div className={styles.cartEmptyBox}>
        <div className={styles.emptyIconCircle}>
          <ShoppingBagIcon className={styles.emptyCartBagIcon} />
        </div>
        <p className={styles.emptyCartTitle}>Your cart is empty</p>
        <Link href="/products" className={cn(buttonVariants({ size: "lg" }), styles.emptyCartBtn)}>
          Start shopping
        </Link>
      </div>
    )
  }

  return <CartLayout lines={lines} hasUnavailable={hasUnavailable} subtotal={subtotal} charges={charges} onQuantity={setQuantity} onRemove={remove} />
}

function CartLayout({
  lines,
  hasUnavailable,
  subtotal,
  charges,
  onQuantity,
  onRemove,
}: {
  lines: LiveCartLine[]
  hasUnavailable: boolean
  subtotal: number
  charges: ReturnType<typeof calculateCharges>
  onQuantity?: (productId: string, quantity: number) => void
  onRemove?: (productId: string) => void
}) {
  const totalItems = lines.reduce((n, l) => n + l.quantity, 0)
  const availableItems = lines.filter((l) => l.available).reduce((n, l) => n + l.quantity, 0)

  return (
    <div className={styles.cartLayoutGrid}>
      <div className={styles.cartItemsPanel}>
        <div className={styles.panelHeaderRow}>
          <h2 className={styles.panelHeading}>
            Cart items
            <span className={styles.itemCountPill}>
              {totalItems} item{totalItems === 1 ? "" : "s"}
            </span>
          </h2>
          <Link href="/products" className={styles.continueShoppingLink}>
            Continue shopping
          </Link>
        </div>

        {hasUnavailable && (
          <p className={styles.unavailableAlert}>
            <AlertTriangleIcon className={styles.alertIcon} />
            Some items are sold out or no longer available. Please remove them to continue.
          </p>
        )}
        <ul className={styles.cartLinesList}>
          <AnimatePresence initial={false}>
            {lines.map((item) => (
              <m.li
                key={item.productId}
                layout
                exit={{ opacity: 0, x: -40 }}
                className={cn(styles.cartLineRow, !item.available && styles.cartLineUnavailable)}
              >
                <Link
                  href={`/products/${item.slug}`}
                  className={styles.lineThumbLink}
                >
                  <ProductImage src={item.image} alt={item.name} sizes="112px" />
                </Link>
                <div className={styles.lineBody}>
                  <div className={styles.lineHeader}>
                    <div className={styles.lineTitleGroup}>
                      <Link href={`/products/${item.slug}`} className={styles.lineNameLink}>
                        {item.name}
                      </Link>
                      <p className={styles.linePriceSub}>
                        {item.available ? formatPrice(item.price) : "Unavailable"}
                        {item.priceChanged && <span className={styles.priceChangedTag}>(price updated)</span>}
                      </p>
                      {item.available && (item.shippingClass !== "standard" || item.weightGrams > 0) && (
                        <p className={styles.shippingClassPill}>
                          {[
                            item.shippingClass === "oversized" ? "Large / bulky" : item.shippingClass === "fragile" ? "Fragile" : null,
                            item.weightGrams > 0 ? `${formatWeightGrams(item.weightGrams)} each` : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemove?.(item.productId)}
                      className={styles.lineRemoveBtn}
                      aria-label={`Remove ${item.name}`}
                    >
                      <Trash2Icon className={styles.trashIcon} />
                    </button>
                  </div>
                  {item.available && (
                    <div className={styles.lineFooter}>
                      <QuantityStepper
                        label={item.name}
                        value={item.quantity}
                        max={Math.min(item.maxQuantity, MAX_QTY_PER_ITEM)}
                        onChange={(q) => onQuantity?.(item.productId, q)}
                      />
                      <span className={styles.lineSubtotalText}>{formatPrice(item.price * item.quantity)}</span>
                    </div>
                  )}
                </div>
              </m.li>
            ))}
          </AnimatePresence>
        </ul>
      </div>

      <aside className={styles.summarySidebar}>
        <h2 className={styles.summaryHeading}>
          Order summary
          <span className={styles.summaryItemCount}>
            {availableItems} item{availableItems === 1 ? "" : "s"}
          </span>
        </h2>
        <FreeShippingBar subtotal={subtotal} />
        <PriceBreakdown {...charges} itemCount={availableItems} />
        <p className={styles.upiNoteBox}>
          <span className={styles.upiNoteStrong}>Instant UPI payment at checkout.</span> Order is placed once you submit your UTR. Cash on delivery isn&apos;t available.
        </p>
        <Link
          href="/checkout"
          aria-disabled={hasUnavailable}
          tabIndex={hasUnavailable ? -1 : undefined}
          onClick={(e) => {
            if (hasUnavailable) e.preventDefault()
          }}
          className={cn(
            buttonVariants({ size: "lg" }),
            styles.proceedCheckoutBtn,
            hasUnavailable && styles.proceedCheckoutDisabled
          )}
        >
          Proceed to checkout <ArrowRightIcon className={styles.proceedArrow} />
        </Link>
      </aside>
    </div>
  )
}
