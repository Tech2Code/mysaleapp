import { InvoicePageView } from "@/components/account/account-views"
import { Skeletonize } from "@/components/shared/skeletonize"
import { placeholderOrder } from "@/features/orders/placeholders"
import { DEFAULT_SETTINGS } from "@/features/settings/defaults"

export default function Loading() {
  return (
    <Skeletonize>
      <InvoicePageView order={placeholderOrder(1)} shop={DEFAULT_SETTINGS} backHref="/account/orders" />
    </Skeletonize>
  )
}
