import type { ReactNode } from "react"
import styles from "@/components/admin/admin-core.module.css"
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
    <section className={cn("adminCard", styles.dashboardCard, className)}>
      <div className={styles.dashboardCardHeader}>
        <div className={styles.cardHeaderTitleWrap}>
          <h2 className={styles.cardHeaderTitle}>{title}</h2>
          {subtitle && <p className={styles.cardHeaderSub}>{subtitle}</p>}
        </div>
        {action && <div className={styles.cardHeaderAction}>{action}</div>}
      </div>
      <div className={styles.dashboardCardBody}>{children}</div>
    </section>
  )
}
