import { CheckIcon, XIcon } from "lucide-react"
import { STATUS_META, type OrderStatus, type ShippingDetails, type StatusHistoryEntry } from "@/features/orders/types"
import { formatDateTime } from "@/lib/format"
import { cn } from "@/lib/utils"
import { ShippingInfo } from "./shipping-info"

const FLOW: OrderStatus[] = ["pending", "confirmed", "packed", "shipped", "delivered"]

type StepState = "done" | "current" | "upcoming" | "cancelled"
type Step = { key: OrderStatus; state: StepState; detail: string }

/** Full class names (not built dynamically) so Tailwind can see them. */
const PULSE = {
  primary: ["bg-primary/40", "bg-primary/30"],
  success: ["bg-success/40", "bg-success/30"],
  destructive: ["bg-destructive/40", "bg-destructive/30"],
} as const

const time = (iso: string) => Date.parse(iso)

/** Latest time `status` was set, optionally only counting changes up to `until`. */
function lastReached(history: StatusHistoryEntry[], status: OrderStatus, until?: number): string | undefined {
  return history
    .filter((h) => h.status === status && (until === undefined || time(h.changedAt) <= until))
    .sort((a, b) => time(a.changedAt) - time(b.changedAt))
    .at(-1)?.changedAt
}

function buildSteps(status: OrderStatus, history: StatusHistoryEntry[]): Step[] {
  if (status === "cancelled") {
    const cancelledAt = lastReached(history, "cancelled")
    const until = cancelledAt ? time(cancelledAt) : undefined

    // Only the steps the order actually went through before it was cancelled.
    const reached = FLOW.flatMap((s) => {
      const at = lastReached(history, s, until)
      return at ? [{ key: s, state: "done" as const, detail: formatDateTime(at) }] : []
    })

    const lastStep = reached.at(-1)
    const cancelledDetail = [
      lastStep ? `Cancelled after ${STATUS_META[lastStep.key].label}` : null,
      cancelledAt ? formatDateTime(cancelledAt) : null,
    ]
      .filter(Boolean)
      .join(" · ")

    return [...reached, { key: "cancelled", state: "cancelled", detail: cancelledDetail || "This order was cancelled" }]
  }

  const currentIndex = FLOW.indexOf(status)
  return FLOW.map((s, i) => {
    const at = lastReached(history, s)
    return {
      key: s,
      state: i < currentIndex ? "done" : i === currentIndex ? "current" : "upcoming",
      detail: i <= currentIndex && at ? formatDateTime(at) : STATUS_META[s].description,
    }
  })
}

/** Vertical progress timeline, shared by customers and admins. */
export function OrderTimeline({
  status,
  history,
  shipping,
}: {
  status: OrderStatus
  history: StatusHistoryEntry[]
  /** Courier / tracking info; shown right under the "Shipped" step, before "Delivered". */
  shipping?: ShippingDetails | null
}) {
  const steps = buildSteps(status, history)

  return (
    <ol data-ui="shared/OrderTimeline" className="relative space-y-6">
      {steps.map((step, i) => {
        const next = steps[i + 1]
        const reached = step.state !== "upcoming"
        const isDelivered = step.key === "delivered" && reached
        const isCancelled = step.state === "cancelled"
        const tone = isCancelled ? "destructive" : isDelivered ? "success" : "primary"

        return (
          <li key={step.key} className="relative flex gap-4">
            {next && (
              <span
                aria-hidden
                className={cn(
                  "absolute top-9 left-[1.05rem] h-[calc(100%-0.75rem)] w-0.5 rounded-full",
                  next.state === "upcoming" && "bg-border",
                  next.state === "cancelled" && "bg-destructive/50",
                  (next.state === "done" || next.state === "current") && (next.key === "delivered" ? "bg-success" : "bg-primary")
                )}
              />
            )}
            <span
              className={cn(
                "relative z-10 grid size-9 shrink-0 place-items-center rounded-full border-2 transition-colors",
                !reached && "border-border bg-background text-muted-foreground",
                reached && !isDelivered && !isCancelled && "border-primary bg-primary text-primary-foreground",
                isDelivered && "border-success-solid bg-success-solid text-white",
                isCancelled && "border-destructive-solid bg-destructive-solid text-white",
                step.state === "current" && (isDelivered ? "ring-4 ring-success/25" : "ring-4 ring-primary/20"),
                isCancelled && "ring-4 ring-destructive/20"
              )}
            >
              {/* The step the order is on right now pulses: terracotta while in progress,
                  green once delivered, red when cancelled. Reduced-motion users get no animation (globals.css). */}
              {(step.state === "current" || isCancelled) && (
                <>
                  <span aria-hidden className={cn("absolute inset-0 rounded-full animate-ping [animation-duration:2.2s]", PULSE[tone][0])} />
                  <span
                    aria-hidden
                    className={cn("absolute inset-0 rounded-full animate-ping [animation-delay:1.1s] [animation-duration:2.2s]", PULSE[tone][1])}
                  />
                </>
              )}
              {isCancelled ? (
                <XIcon className="relative size-4 animate-in zoom-in-50 duration-500" />
              ) : reached ? (
                <CheckIcon
                  className={cn("relative size-4", step.state === "current" && "animate-in zoom-in-50 spin-in-12 duration-500")}
                />
              ) : (
                <span className="text-xs font-semibold">{FLOW.indexOf(step.key) + 1}</span>
              )}
            </span>
            <div className="min-w-0 flex-1 pt-1">
              <p className={cn("font-semibold", !reached && "text-muted-foreground", isCancelled && "text-destructive")}>
                {STATUS_META[step.key].label}
                {step.state === "current" && <span className="sr-only"> (current status)</span>}
              </p>
              <p className="text-sm text-muted-foreground">{step.detail}</p>
              {step.key === "shipped" && reached && shipping && <ShippingInfo shipping={shipping} className="mt-3" />}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
