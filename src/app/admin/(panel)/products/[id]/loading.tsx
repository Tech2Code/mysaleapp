import { PanelSkeleton } from "@/components/admin/panel-skeleton"

// Gives this page its own <Suspense> boundary, so navigating here shows a skeleton instantly
// while the data loads (Next.js "instant navigation" rule).
export default function Loading() {
  return <PanelSkeleton />
}
