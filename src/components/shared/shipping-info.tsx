import { CalendarClockIcon, ExternalLinkIcon, HashIcon, TruckIcon } from "lucide-react"
import type { ShippingDetails } from "@/features/orders/types"
import { formatDate } from "@/lib/format"
import { cn } from "@/lib/utils"
import { CopyButton } from "./copy-button"

/**
 * Courier, tracking number/link and expected delivery.
 * Rendered inside the order timeline, under the "Shipped" step.
 */
export function ShippingInfo({ shipping, className }: { shipping: ShippingDetails; className?: string }) {
  return (
    <section data-ui="shared/ShippingInfo"
      aria-label="Shipping details"
      className={cn(
        "space-y-3 rounded-2xl border border-violet-200 bg-violet-50/60 p-4 dark:border-violet-900/50 dark:bg-violet-950/20",
        className
      )}
    >
      <dl className="space-y-2.5 text-sm">
        <div className="flex items-center gap-3">
          <dt className="flex w-28 shrink-0 items-center gap-2 text-muted-foreground">
            <TruckIcon className="size-4" aria-hidden /> Courier
          </dt>
          <dd className="min-w-0 font-medium">{shipping.carrier}</dd>
        </div>

        {shipping.trackingNumber && (
          <div className="flex items-center gap-3">
            <dt className="flex w-28 shrink-0 items-center gap-2 text-muted-foreground">
              <HashIcon className="size-4" aria-hidden /> Tracking no.
            </dt>
            <dd className="flex min-w-0 items-center gap-1 font-mono font-semibold">
              <span className="[overflow-wrap:anywhere]">{shipping.trackingNumber}</span>
              <CopyButton value={shipping.trackingNumber} label="Tracking number" variant="icon" className="shrink-0" />
            </dd>
          </div>
        )}

        {shipping.expectedDelivery && (
          <div className="flex items-center gap-3">
            <dt className="flex w-28 shrink-0 items-center gap-2 text-muted-foreground">
              <CalendarClockIcon className="size-4" aria-hidden /> Expected by
            </dt>
            <dd className="font-medium">{formatDate(`${shipping.expectedDelivery}T00:00:00`)}</dd>
          </div>
        )}
      </dl>

      {shipping.trackingUrl && (
        <a
          href={shipping.trackingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-9 items-center gap-2 rounded-full bg-violet-600 px-4 text-sm font-semibold text-white shadow-md shadow-violet-600/20 transition-transform hover:-translate-y-0.5"
        >
          Track shipment <ExternalLinkIcon className="size-4" />
        </a>
      )}
    </section>
  )
}
