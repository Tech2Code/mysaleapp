import { DashboardView } from "@/components/admin/dashboard/dashboard-view"
import { Skeletonize } from "@/components/shared/skeletonize"
import { PLACEHOLDER_TODAY, placeholderDashboard, placeholderDashboardRange } from "@/features/orders/placeholders"

export default function Loading() {
  return (
    <Skeletonize>
      <DashboardView d={placeholderDashboard()} range={placeholderDashboardRange()} today={PLACEHOLDER_TODAY} />
    </Skeletonize>
  )
}
