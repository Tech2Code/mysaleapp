import { DashboardPageSkeleton } from "@/components/admin/admin-skeletons"

// Wraps every admin page in <Suspense>. This file is the dashboard's loading state; every other
// admin route has its own loading.tsx with a skeleton that matches its layout.
export default function AdminPanelLoading() {
  return <DashboardPageSkeleton />
}
