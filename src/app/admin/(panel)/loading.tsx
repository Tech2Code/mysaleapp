import { PanelSkeleton } from "@/components/admin/panel-skeleton"

// Wraps every admin page in <Suspense>, so pages can read params/searchParams
// and fetch data without blocking navigation.
export default function AdminPanelLoading() {
  return <PanelSkeleton />
}
