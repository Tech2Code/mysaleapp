import { ExternalLinkIcon, PlusIcon } from "lucide-react"
import Link from "next/link"
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
    <div data-ui="admin/DashboardView" className="space-y-6">
      <header data-ui="admin/DashboardView/header-flex" className="flex flex-wrap items-end justify-between gap-4">
        <div data-ui="admin/DashboardView/div">
          <p data-ui="admin/DashboardView/p" className="text-sm text-muted-foreground">{d.todayLabel}</p>
          <h1 data-ui="admin/DashboardView/h1" className="mt-1 text-2xl font-semibold sm:text-3xl">{d.greeting} 👋</h1>
          <p data-ui="admin/DashboardView/p-2" className="mt-1 text-sm text-muted-foreground">
            {attentionTotal > 0
              ? `You have ${attentionTotal} thing${attentionTotal === 1 ? "" : "s"} that need attention.`
              : "Everything is under control."}
          </p>
        </div>
        <div data-ui="admin/DashboardView/div-flex" className="flex flex-wrap gap-2">
          <Link data-ui="admin/DashboardView/Link-view-store" href="/" target="_blank" className={cn(buttonVariants({ variant: "outline" }), "rounded-full")}>
            <ExternalLinkIcon /> View store
          </Link>
          <Link data-ui="admin/DashboardView/Link-add-product" href="/admin/products/new" className={cn(buttonVariants(), "rounded-full px-5")}>
            <PlusIcon /> Add product
          </Link>
        </div>
      </header>

      <DashboardRangeShell current={{ key: range.key, from: range.from, to: range.to }} today={today}>
        <DashboardBody d={d} bucket={range.bucket} />
      </DashboardRangeShell>
    </div>
  )
}
