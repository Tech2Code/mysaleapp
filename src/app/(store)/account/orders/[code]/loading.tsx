import { MyOrderView } from "@/components/account/account-views"
import { Skeletonize } from "@/components/shared/skeletonize"
import { placeholderOrderWithHistory } from "@/features/orders/placeholders"
import { DEFAULT_SETTINGS } from "@/features/settings/defaults"

export default function Loading() {
  return (
    <Skeletonize>
      <MyOrderView order={placeholderOrderWithHistory()} shop={DEFAULT_SETTINGS} win={{ open: false, until: null }} />
    </Skeletonize>
  )
}
