import type { ReactNode } from "react"
import { CalendarClockIcon, ExternalLinkIcon, HashIcon, TruckIcon } from "lucide-react"
import type { ShippingDetails } from "@/features/orders/types"
import { formatDate } from "@/lib/format"
import { safeExternalUrl } from "@/lib/safe-redirect"
import { cn } from "@/lib/utils"
import { CopyButton } from "./copy-button"
import styles from "./shared.module.css"

/**
 * Courier, tracking number/link and expected delivery.
 * Rendered inside the order timeline, under the "Shipped" step.
 */
export function ShippingInfo({ shipping, className, action }: { shipping: ShippingDetails; className?: string; /** Admin only: e.g. an "Edit" button, shown on the right. */ action?: ReactNode }) {
  const trackingHref = safeExternalUrl(shipping.trackingUrl, true)
  return (
    <section
      aria-label="Shipping details"
      className={cn(
        styles.shippingInfoCard,
        className
      )}
    >
      <dl className={styles.shippingDl}>
        <div className={cn(styles.shippingRow, action && styles.shippingRowWithAction)}>
          <dt className={styles.shippingDt}>
            <TruckIcon className={styles.icon16} aria-hidden /> Courier
          </dt>
          <dd className={styles.shippingDd}>{shipping.carrier}</dd>
        </div>

        {shipping.trackingNumber && (
          <div className={styles.shippingRow}>
            <dt className={styles.shippingDt}>
              <HashIcon className={styles.icon16} aria-hidden /> Tracking no.
            </dt>
            <dd className={styles.trackingMonoDd}>
              <span className={styles.trackingBreak}>{shipping.trackingNumber}</span>
              <CopyButton value={shipping.trackingNumber} label="Tracking number" variant="icon" className={styles.compactCopyBtn} />
            </dd>
          </div>
        )}

        {shipping.expectedDelivery && (
          <div className={styles.shippingRow}>
            <dt className={styles.shippingDt}>
              <CalendarClockIcon className={styles.icon16} aria-hidden /> Estimated delivery
            </dt>
            <dd className={styles.shippingDd}>
              By {formatDate(`${shipping.expectedDelivery}T00:00:00`)}
            </dd>
          </div>
        )}
      </dl>
      {action && <div className={styles.shippingActionCorner}>{action}</div>}

      {trackingHref && (
        <a
          href={trackingHref}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.trackShipmentBtn}
        >
          Track shipment <ExternalLinkIcon className={styles.icon16} />
        </a>
      )}
    </section>
  )
}
