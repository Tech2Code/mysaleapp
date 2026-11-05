import { Skeleton } from "@/components/ui/skeleton"

/** Loading placeholder for admin pages (shown instantly while data streams in). */
export function PanelSkeleton() {
  return (
    <div data-ui="admin/PanelSkeleton" className="space-y-4" aria-hidden>
      <Skeleton className="h-10 w-56 rounded-xl" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-2xl" />
    </div>
  )
}
