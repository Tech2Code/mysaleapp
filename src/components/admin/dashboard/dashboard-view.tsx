import { ExternalLinkIcon, PlusIcon } from "lucide-react"
import Link from "next/link"
import styles from "@/components/admin/admin-core.module.css"
import { DashboardBody } from "@/components/admin/dashboard/dashboard-body"
import { DashboardRangeShell } from "@/components/admin/dashboard-range"
import { buttonVariants } from "@/components/ui/button"
import type { DashboardData } from "@/features/orders/admin-queries"
import type { DashboardRange } from "@/features/orders/dashboard-range"
import { cn } from "@/lib/utils"

/** The whole admin dashboard. The page passes real data; loading.tsx passes placeholder data inside <Skeletonize>. */
export function DashboardView({ d, range, today }: { d: DashboardData; range: Pick<DashboardRange, "key" | "from" | "to" | "bucket">; today: string }) {
  const attentionTotal = d.attention.toVerify + d.attention.awaitingPayment + d.attention.toFulfil + d.attention.returnRequests + d.attention.returnsToReceive + d.attention.refundsToSend + d.lowStock.length

  return (
    <div className={styles.dashboardView}>
      <header className={styles.dashboardHeader}>
        <div className={styles.greetingCol}>
          <p className={styles.todayText}>{d.todayLabel}</p>
          <h1 className={styles.greetingHeading}>
            <span>{d.greeting}</span>
          </h1>
          <p className={styles.greetingSub}>
            {attentionTotal > 0
              ? `${attentionTotal} item${attentionTotal === 1 ? "" : "s"} across orders, returns, and inventory need review.`
              : "All orders, payments, and stock levels are in good shape."}
          </p>
        </div>
        <div className={styles.headerCtaRow}>
          <Link href="/" target="_blank" rel="noopener noreferrer" className={cn(buttonVariants({ variant: "outline", size: "sm" }), styles.viewStoreBtn)}>
            <ExternalLinkIcon className={styles.icon14} /> View store
          </Link>
          <Link href="/admin/products/new" className={cn(buttonVariants({ size: "sm" }), styles.addProductBtn)}>
            <PlusIcon className={styles.icon14} /> Add product
          </Link>
        </div>
      </header>

      <DashboardRangeShell key={`${range.key}-${range.from}-${range.to}`} current={{ key: range.key, from: range.from, to: range.to }} today={today}>
        <DashboardBody d={d} bucket={range.bucket} />
      </DashboardRangeShell>
    </div>
  )
}
