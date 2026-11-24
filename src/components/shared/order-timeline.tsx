import { CheckIcon, XIcon } from "lucide-react"
import type { ReactNode } from "react"
import { returnTimeline, type ReturnStageInput } from "@/features/orders/returns"
import { STATUS_META, type OrderStatus, type ShippingDetails, type StatusHistoryEntry } from "@/features/orders/types"
import { formatDateTime } from "@/lib/format"
import { cn } from "@/lib/utils"
import { ShippingInfo } from "./shipping-info"
import styles from "./shared.module.css"

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

const PULSE = {
  primary: [styles.pingPrimary1, styles.pingPrimary2],
  success: [styles.pingSuccess1, styles.pingSuccess2],
  destructive: [styles.pingDestructive1, styles.pingDestructive2],
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
    const lastActiveBeforeCancel = history
      .filter((h) => h.status !== "cancelled" && (until === undefined || time(h.changedAt) <= until))
      .sort((a, b) => time(a.changedAt) - time(b.changedAt))
      .at(-1)?.status
    const maxReachedIndex = lastActiveBeforeCancel ? FLOW.indexOf(lastActiveBeforeCancel) : FLOW.length - 1

    // Only the steps the order was actually at before it was cancelled (excluding any step that was reverted).
    const reached = FLOW.flatMap((s, idx) => {
      if (maxReachedIndex >= 0 && idx > maxReachedIndex) return []
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
  return returnTimeline(input).map((e) => {
    const isReplacementStep =
      e.key === "refund" &&
      (e.label.includes("Exchange") || e.label.includes("Replacement") || e.customerLabel.includes("Replacement"))
    const fallbackDetail =
      e.state === "done"
        ? "Done"
        : isReplacementStep
          ? "Replacement item goes out to you"
          : RETURN_WAITING[e.key] ?? ""
    return {
      key: "return-" + e.key,
      label: audience === "admin" ? e.label : e.customerLabel,
      state: e.state === "stopped" ? ("cancelled" as const) : e.state,
      detail:
        [e.at ? formatDateTime(e.at) : null, e.note, audience === "admin" ? e.adminDetail : null].filter(Boolean).join(" · ") ||
        fallbackDetail,
      success: e.key === "refund" && e.state === "done",
    }
  })
}

/** Vertical progress timeline, shared by customers and admins. A return continues it after "Delivered". */
export function OrderTimeline({
  status,
  history,
  shipping,
  shippingAction,
  returnInput,
  audience = "customer",
}: {
  status: OrderStatus
  history: StatusHistoryEntry[]
  /** Courier / tracking info; shown right under the "Shipped" step, before "Delivered". */
  shipping?: ShippingDetails | null
  /** Admin only: rendered on the right of the shipping card (the courier "Edit" button). */
  shippingAction?: ReactNode
  /** When the order has a return, its steps are added after Delivered. */
  returnInput?: ReturnStageInput
  audience?: "admin" | "customer"
}) {
  const base = buildSteps(status, history)
  const extra = returnInput && status === "delivered" ? returnSteps(returnInput, audience) : []
  // With a return under way the order itself is finished: only the return step pulses.
  const steps: Step[] = extra.length ? [...base.map((st) => (st.key === "delivered" ? { ...st, state: "done" as const } : st)), ...extra] : base

  return (
    <ol className={styles.timelineList}>
      {steps.map((step, i) => {
        const next = steps[i + 1]
        const reached = step.state !== "upcoming"
        const isDelivered = (step.key === "delivered" || step.success === true) && reached
        const isCancelled = step.state === "cancelled"
        const tone = isCancelled ? "destructive" : isDelivered ? "success" : "primary"

        return (
          <li key={step.key} className={styles.timelineStepLi}>
            {/* Circle + connector share one column, so the line always starts under the circle, is centred on it
                and stretches to the next one, however tall the text beside it gets. */}
            <div className={styles.timelineRailCol}>
            <span
              className={cn(
                styles.stepCircle,
                reached && !isDelivered && !isCancelled && styles.stepCirclePrimary,
                isDelivered && styles.stepCircleDelivered,
                isCancelled && styles.stepCircleCancelled,
                step.state === "current" && (isDelivered ? styles.stepCircleCurrentSuccess : styles.stepCircleCurrentPrimary)
              )}
            >
              {/* The step the order is on right now pulses: terracotta while in progress,
                  green once delivered, red when cancelled. Reduced-motion users get no animation (globals.css). */}
              {(step.state === "current" || isCancelled) && (
                <>
                  <span aria-hidden className={cn(styles.pingRing, PULSE[tone][0])} />
                  <span
                    aria-hidden
                    className={cn(styles.pingRing, styles.pingRingDelayed, PULSE[tone][1])}
                  />
                </>
              )}
              {isCancelled ? (
                <XIcon className={styles.stepIconRelative} />
              ) : reached ? (
                <CheckIcon className={styles.stepIconRelative} />
              ) : (
                <span className={styles.stepNumberText}>{i + 1}</span>
              )}
            </span>
            {next && (
              <span
                aria-hidden
                className={cn(
                  styles.stepConnector,
                  next.state === "cancelled" && styles.connectorCancelled,
                  (next.state === "done" || next.state === "current") && (next.key === "delivered" || next.success ? styles.connectorSuccess : styles.connectorPrimary)
                )}
              />
            )}
            </div>
            <div className={cn(styles.stepBodyCol, next && (step.key === "shipped" && shipping ? styles.stepBodyPadSm : styles.stepBodyPadLg))}>
              <p className={cn(styles.stepTitle, !reached && styles.stepTitleUpcoming, isCancelled && styles.stepTitleCancelled)}>
                {step.label}
                {step.state === "current" && <span className={styles.srOnly}> (current status)</span>}
              </p>
              <p className={styles.stepDetailText}>{step.detail}</p>
              {step.key === "shipped" && reached && shipping && <ShippingInfo shipping={shipping} className={styles.shippingInfoMargin} action={shippingAction} />}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
