import { CheckIcon, XIcon } from "lucide-react"
import { STATUS_META, type OrderStatus, type StatusHistoryEntry } from "@/features/orders/types"
import { formatDateTime } from "@/lib/format"
import { cn } from "@/lib/utils"

const FLOW: OrderStatus[] = ["pending", "confirmed", "packed", "shipped", "delivered"]

/** Vertical progress timeline. Works for both customers and admins. */
export function OrderTimeline({ status, history }: { status: OrderStatus; history: StatusHistoryEntry[] }) {
  const when = (s: OrderStatus) => history.filter((h) => h.status === s).at(-1)?.changedAt

  if (status === "cancelled") {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-destructive/10 p-4 text-destructive">
        <span className="grid size-9 place-items-center rounded-full bg-destructive text-white">
          <XIcon className="size-4" />
        </span>
        <div>
          <p className="font-semibold">Order cancelled</p>
          {when("cancelled") && <p className="text-xs opacity-80">{formatDateTime(when("cancelled")!)}</p>}
        </div>
      </div>
    )
  }

  const currentIndex = FLOW.indexOf(status)

  return (
    <ol className="relative space-y-6">
      {FLOW.map((step, i) => {
        const done = i <= currentIndex
        const current = i === currentIndex
        const at = when(step)
        return (
          <li key={step} className="relative flex gap-4">
            {i < FLOW.length - 1 && (
              <span
                aria-hidden
                className={cn(
                  "absolute top-9 left-[1.05rem] h-[calc(100%-0.75rem)] w-0.5 rounded-full",
                  i < currentIndex ? "bg-primary" : "bg-border"
                )}
              />
            )}
            <span
              className={cn(
                "relative z-10 grid size-9 shrink-0 place-items-center rounded-full border-2 transition-colors",
                done ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground",
                current && "ring-4 ring-primary/20"
              )}
            >
              {done ? <CheckIcon className="size-4" /> : <span className="text-xs font-semibold">{i + 1}</span>}
            </span>
            <div className="pt-1">
              <p className={cn("font-semibold", !done && "text-muted-foreground")}>
                {STATUS_META[step].label}
                {current && <span className="sr-only"> (current status)</span>}
              </p>
              <p className="text-sm text-muted-foreground">
                {at ? formatDateTime(at) : STATUS_META[step].description}
              </p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
