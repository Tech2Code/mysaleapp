import { CheckIcon, XIcon } from "lucide-react"
import { returnTimeline, type ReturnStageInput } from "@/features/orders/returns"
import { STATUS_META, type OrderStatus, type ShippingDetails, type StatusHistoryEntry } from "@/features/orders/types"
import { formatDateTime } from "@/lib/format"
import { cn } from "@/lib/utils"
import { ShippingInfo } from "./shipping-info"

const FLOW: OrderStatus[] = ["pending", "confirmed", "packed", "shipped", "delivered"]

type StepState = "done" | "current" | "upcoming" | "cancelled"
type Step = {
  key: string
  label: string
  state: StepState
  detail: string
  /** Green circle (Delivered, or the refund done). */
  success?: boolean
}

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
      return at ? [{ key: s, label: STATUS_META[s].label, state: "done" as const, detail: formatDateTime(at) }] : []
    })

    const lastStep = reached.at(-1)
    const cancelledDetail = [
      lastStep ? `Cancelled after ${lastStep.label}` : null,
      cancelledAt ? formatDateTime(cancelledAt) : null,
    ]
      .filter(Boolean)
      .join(" · ")

    return [...reached, { key: "cancelled", label: STATUS_META.cancelled.label, state: "cancelled", detail: cancelledDetail || "This order was cancelled" }]
  }

  const currentIndex = FLOW.indexOf(status)
  return FLOW.map((s, i) => {
    const at = lastReached(history, s)
    return {
      key: s,
      label: STATUS_META[s].label,
      state: i < currentIndex ? "done" : i === currentIndex ? "current" : "upcoming",
      detail: i <= currentIndex && at ? formatDateTime(at) : STATUS_META[s].description,
    }
  })
}

const RETURN_WAITING: Record<string, string> = {
  requested: "Waiting for your request",
  approved: "Waiting for approval",
  pickup: "Date is shared once approved",
  picked_up: "The courier collects the items",
  received: "We check the items",
  refund: "Money goes back to you",
}

/** The return steps (requested, approved, pickup, picked up, received, refund) that continue the order timeline after Delivered. */
function returnSteps(input: ReturnStageInput, audience: "admin" | "customer"): Step[] {
  return returnTimeline(input).map((e) => ({
    key: "return-" + e.key,
    label: audience === "admin" ? e.label : e.customerLabel,
    state: e.state === "stopped" ? ("cancelled" as const) : e.state,
    detail:
      [e.at ? formatDateTime(e.at) : null, e.note, audience === "admin" ? e.adminDetail : null].filter(Boolean).join(" · ") ||
      (e.state === "done" ? "Done" : RETURN_WAITING[e.key] ?? ""),
    success: e.key === "refund" && e.state === "done",
  }))
}

/** Vertical progress timeline, shared by customers and admins. A return continues it after "Delivered". */
export function OrderTimeline({
  status,
  history,
  shipping,
  returnInput,
  audience = "customer",
}: {
  status: OrderStatus
  history: StatusHistoryEntry[]
  /** Courier / tracking info; shown right under the "Shipped" step, before "Delivered". */
  shipping?: ShippingDetails | null
  /** When the order has a return, its steps are added after Delivered. */
  returnInput?: ReturnStageInput
  audience?: "admin" | "customer"
}) {
  const base = buildSteps(status, history)
  const extra = returnInput && status === "delivered" ? returnSteps(returnInput, audience) : []
  // With a return under way the order itself is finished: only the return step pulses.
  const steps: Step[] = extra.length ? [...base.map((st) => (st.key === "delivered" ? { ...st, state: "done" as const } : st)), ...extra] : base

  return (
    <ol data-ui="shared/OrderTimeline">
      {steps.map((step, i) => {
        const next = steps[i + 1]
        const reached = step.state !== "upcoming"
        const isDelivered = (step.key === "delivered" || step.success === true) && reached
        const isCancelled = step.state === "cancelled"
        const tone = isCancelled ? "destructive" : isDelivered ? "success" : "primary"

        return (
          <li data-ui="shared/OrderTimeline/li-flex" key={step.key} className="flex gap-4">
            {/* Circle + connector share one column, so the line always starts under the circle, is centred on it
                and stretches to the next one, however tall the text beside it gets. */}
            <div data-ui="shared/OrderTimeline/div-flex" className="flex shrink-0 flex-col items-center">
            <span data-ui="shared/OrderTimeline/span"
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
                  <span data-ui="shared/OrderTimeline/span-2" aria-hidden className={cn("absolute inset-0 rounded-full animate-ping animation-duration-[2.2s]", PULSE[tone][0])} />
                  <span data-ui="shared/OrderTimeline/span-3"
                    aria-hidden
                    className={cn("absolute inset-0 rounded-full animate-ping [animation-delay:1.1s] animation-duration-[2.2s]", PULSE[tone][1])}
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
                <span data-ui="shared/OrderTimeline/span-4" className="text-xs font-semibold">{i + 1}</span>
              )}
            </span>
            {next && (
              <span data-ui="shared/OrderTimeline/span-5"
                aria-hidden
                className={cn(
                  "my-1.5 min-h-4 w-0.5 flex-1 rounded-full",
                  next.state === "upcoming" && "bg-border",
                  next.state === "cancelled" && "bg-destructive/50",
                  (next.state === "done" || next.state === "current") && (next.key === "delivered" || next.success ? "bg-success" : "bg-primary")
                )}
              />
            )}
            </div>
            <div data-ui="shared/OrderTimeline/div" className={cn("min-w-0 flex-1 pt-1.5 leading-snug", next && "pb-6")}>
              <p data-ui="shared/OrderTimeline/p" className={cn("font-semibold", !reached && "text-muted-foreground", isCancelled && "text-destructive")}>
                {step.label}
                {step.state === "current" && <span data-ui="shared/OrderTimeline/span-6" className="sr-only"> (current status)</span>}
              </p>
              <p data-ui="shared/OrderTimeline/p-2" className="text-sm text-muted-foreground">{step.detail}</p>
              {step.key === "shipped" && reached && shipping && <ShippingInfo shipping={shipping} className="mt-3" />}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
