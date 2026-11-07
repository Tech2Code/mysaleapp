import { AdminAccountView } from "@/components/admin/page-views"
import { Skeletonize } from "@/components/shared/skeletonize"

export default function Loading() {
  return (
    <Skeletonize>
      <AdminAccountView name="Admin" phone="9876543210" email="admin@example.com" />
    </Skeletonize>
  )
}
