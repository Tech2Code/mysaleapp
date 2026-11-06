import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export function DashboardCard({ title, action, children, className }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section data-ui="admin/DashboardCard" className={cn("flex flex-col rounded-2xl border bg-card shadow-xs", className)}>
      <div data-ui="admin/DashboardCard/div-flex" className="flex items-center justify-between gap-3 p-5 pb-0 sm:px-6 sm:pt-6">
        <h2 data-ui="admin/DashboardCard/h2" className="font-sans text-base font-semibold">{title}</h2>
        {action}
      </div>
      <div data-ui="admin/DashboardCard/div" className="flex-1 p-5 sm:p-6">{children}</div>
    </section>
  )
}
