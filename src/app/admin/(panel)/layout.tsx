import { Suspense, type ReactNode } from "react"
import { AdminSidebar } from "@/components/admin/admin-sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import { requireAdmin } from "@/features/auth/guards"

/** Server-side gate: every admin page is rendered only for verified admins. */
async function AdminGate({ children }: { children: ReactNode }) {
  await requireAdmin()
  return <>{children}</>
}

function PanelSkeleton() {
  return (
    <div className="space-y-4">
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

export default function AdminPanelLayout({ children }: { children: ReactNode }) {
  return (
    <div className="lg:flex">
      <AdminSidebar />
      <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
        <Suspense fallback={<PanelSkeleton />}>
          <AdminGate>{children}</AdminGate>
        </Suspense>
      </main>
    </div>
  )
}
