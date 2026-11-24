import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export function DashboardCard({
  title,
  subtitle,
  action,
  children,
  className,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section data-ui="admin/DashboardCard" className={cn("adminCard flex flex-col overflow-hidden rounded-xl border", className)}>
      <div data-ui="admin/DashboardCard/div-flex" className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3.5 sm:px-5">
        <div data-ui="admin/DashboardCard/div" className="min-w-0">
          <h2 data-ui="admin/DashboardCard/h2" className="font-sans text-sm font-semibold tracking-tight">{title}</h2>
          {subtitle && <p data-ui="admin/DashboardCard/p" className="mt-0.5 text-[11px] text-muted-foreground">{subtitle}</p>}
        </div>
        {action && <div data-ui="admin/DashboardCard/div-2" className="shrink-0">{action}</div>}
      </div>
      <div data-ui="admin/DashboardCard/div-3" className="flex-1 p-4 sm:p-5">{children}</div>
    </section>
  )
}
