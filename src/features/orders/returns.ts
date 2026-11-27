import { formatDate, formatPrice } from "@/lib/format"
import type { ExchangeFulfillmentStatus, OrderItem, OrderReturn, PaymentStatus, ReturnRequest, ReturnRequestStatus, ReturnResolutionType, ShippingDetails, StatusHistoryEntry } from "./types"

/**
 * Return rules in one place (pure functions, used by pages, client components and server actions).
 * The database enforces the same rules (migration 0012); this is what lets the UI show the right thing first.
 */

export const RETURN_REASONS = [
  "Damaged or broken",
  "Not as described",
  "Wrong item received",
  "Quality isn't what I expected",
  "Changed my mind",
  "Other",
] as const

export const EXCHANGE_REASONS = [
  "Need a different size or dimensions",
  "Prefer a different colour or finish",
  "Ordered the wrong variant by mistake",
  "Want to swap for another design",
  "Other",
] as const

export const REPLACEMENT_REASONS = [
  "Damaged or broken in transit",
  "Defective or flawed piece received",
  "Wrong item delivered instead of ordered item",
  "Missing part or incomplete set",
  "Other",
] as const

/** A request that still needs attention (counts against "one open request per order"). */
export const isOpenRequest = (r: Pick<ReturnRequest, "status">) => r.status === "requested" || r.status === "approved"

const PICKUP_TAG_RE = /(?:\r?\n|^)\[Pickup:\s*([^\]]+)\]/i
const REFUND_UPI_TAG_RE = /(?:\r?\n|^)\[Refund UPI:\s*([^\]]+)\]/i

/** Packs the customer's optional return note, alternate pickup address, and optional refund UPI ID into the 300-char `details` field. */
export function composeReturnDetails(
  details: string | null | undefined,
  pickupAddress: string | null | undefined,
  refundUpiId?: string | null
): string | undefined {
  const cleanDetails = (details ?? "")
    .replace(PICKUP_TAG_RE, "")
    .replace(REFUND_UPI_TAG_RE, "")
    .trim()
  const cleanPickup = (pickupAddress ?? "").replace(/[\[\]\r\n]+/g, " ").replace(/\s+/g, " ").trim()
  const cleanUpi = (refundUpiId ?? "").replace(/[\[\]\r\n\s]+/g, "").trim()

  const tags: string[] = []
  if (cleanUpi) tags.push(`[Refund UPI: ${cleanUpi.slice(0, 64)}]`)
  if (cleanPickup) {
    const maxPickup = Math.max(40, 220 - (cleanUpi ? cleanUpi.length + 16 : 0))
    tags.push(`[Pickup: ${cleanPickup.slice(0, maxPickup)}]`)
  }

  if (tags.length === 0) {
    return cleanDetails ? cleanDetails.slice(0, 300) : undefined
  }
  const tagBlock = tags.join("\n")
  if (!cleanDetails) return tagBlock.slice(0, 300)
  const maxDetailLen = Math.max(0, 300 - tagBlock.length - 1)
  const truncatedDetail = cleanDetails.slice(0, maxDetailLen).trim()
  return truncatedDetail ? `${truncatedDetail}\n${tagBlock}` : tagBlock.slice(0, 300)
}

/** Splits a stored `return_requests.details` string into the customer's reason note, any alternate pickup address, and any refund UPI ID. */
export function splitReturnDetails(raw: string | null | undefined): {
  details: string | null
  pickupAddress: string | null
  refundUpiId?: string | null
} {
  if (!raw) return { details: null, pickupAddress: null }
  const pickupMatch = raw.match(PICKUP_TAG_RE)
  const upiMatch = raw.match(REFUND_UPI_TAG_RE)
  const pickupAddress = pickupMatch?.[1]?.trim() || null
  const refundUpiId = upiMatch?.[1]?.trim() || null
  const details =
    raw
      .replace(PICKUP_TAG_RE, "")
      .replace(REFUND_UPI_TAG_RE, "")
      .trim() || null
  return refundUpiId ? { details, pickupAddress, refundUpiId } : { details, pickupAddress }
}

/** When the order was delivered: the latest "delivered" entry in its history, provided no later entry moved it back. */
export function deliveredAt(history: StatusHistoryEntry[]): string | null {
  if (history.length === 0) return null
  const sorted = history.toSorted((a, b) => Date.parse(a.changedAt) - Date.parse(b.changedAt))
  const latest = sorted.at(-1)
  if (latest?.status !== "delivered") return null
  return latest.changedAt
}

/** Effective return window days for an order: max of each item's `returnWindowDays` (falling back to `windowDays`). */
export function effectiveReturnDays(windowDays: number, items?: Pick<OrderItem, "returnWindowDays">[]): number {
  if (!items || items.length === 0) return Math.max(0, windowDays)
  return Math.max(0, ...items.map((i) => (i.returnWindowDays == null ? windowDays : Number(i.returnWindowDays))))
}

/**
 * The return window: `until` is the last moment a request can be made; `open` is whether that is still ahead.
 * When `items` are passed, uses the longest item return window on the order so mixed-window orders stay open
 * as long as at least one item is still inside its window.
 * `now` is passed in so callers read the clock themselves (after connection() in server components).
 */
export function returnWindow(
  history: StatusHistoryEntry[],
  windowDays: number,
  now: Date,
  items?: Pick<OrderItem, "returnWindowDays">[]
): { until: Date | null; open: boolean } {
  const effectiveDays = items && items.length > 0 ? effectiveReturnDays(windowDays, items) : windowDays
  const delivered = deliveredAt(history)
  if (!delivered || effectiveDays <= 0) return { until: null, open: false }
  const deliveredMs = new Date(delivered).getTime()
  if (Number.isNaN(deliveredMs)) return { until: null, open: false }
  const until = new Date(deliveredMs + effectiveDays * 86_400_000)
  return { until, open: now.getTime() <= until.getTime() }
}

/** Return & exchange window for one specific ordered item. When `now` is omitted (SSR/prerender), `open` is true while `days > 0` and the caller intersects with the server-computed order window. */
export function itemReturnWindow(
  history: StatusHistoryEntry[],
  itemWindowDays: number | null | undefined,
  defaultWindowDays: number,
  now?: Date | null
): { until: Date | null; open: boolean; days: number } {
  const days = itemWindowDays == null ? defaultWindowDays : Math.max(0, Math.trunc(Number(itemWindowDays)))
  const delivered = deliveredAt(history)
  if (!delivered || days <= 0) return { until: null, open: false, days }
  const deliveredMs = new Date(delivered).getTime()
  if (Number.isNaN(deliveredMs)) return { until: null, open: false, days }
  const until = new Date(deliveredMs + days * 86_400_000)
  return { until, open: now ? now.getTime() <= until.getTime() : true, days }
}

/** Stable line key for return/exchange forms & maps: `productId::variantId` when a variant is present, else `productId`. */
export const returnLineKey = (item: { productId: string; variantId?: string | null }): string =>
  item.variantId ? `${item.productId}::${item.variantId}` : item.productId

/** How many of each ordered line (product or variant) can still be sent back: ordered minus goods already received back. */
export function returnableQuantities(items: OrderItem[], returns: OrderReturn[]): Map<string, number> {
  const left = new Map<string, number>()
  for (const i of items) {
    const key = returnLineKey(i)
    left.set(key, (left.get(key) ?? 0) + i.quantity)
  }
  for (const r of returns) {
    if (r.resolutionType === "exchange") continue
    for (const i of r.items) {
      const key = returnLineKey(i)
      if (left.has(key)) {
        left.set(key, (left.get(key) ?? 0) - i.quantity)
      } else if (!i.variantId) {
        // Legacy return row without variantId: decrement matching product line(s)
        const matchingKey = [...left.keys()].find((k) => k === i.productId || k.startsWith(`${i.productId}::`))
        if (matchingKey) {
          left.set(matchingKey, (left.get(matchingKey) ?? 0) - i.quantity)
        } else {
          left.set(key, -i.quantity)
        }
      } else {
        left.set(key, (left.get(key) ?? 0) - i.quantity)
      }
    }
  }
  return left
}

// ---------------------------------------------------------------------------
// Return stage: ONE derived state for "where is this order's return?" (the order's own status stays
// 'delivered'; orders.status is never extended). Computed from return_requests + order_returns + the
// payment/refund fields, and used by every screen that shows an order (admin list/page, customer list/page,
// guest track page, timeline, WhatsApp messages), so the wording can't drift.
// ---------------------------------------------------------------------------

export type ReturnStageKey =
  | "requested"
  | "approved"
  | "picked_up"
  | "rejected"
  | "withdrawn"
  | "received"
  | "exchange_dispatched"
  | "exchange_completed"
  | "partly_refunded"
  | "refunded"
export type ReturnStageTone = "info" | "progress" | "success" | "danger" | "neutral"

const isReplacementPref = (pref?: string | null) => /^replacement\s*:/i.test(pref ?? "")

/** After this many days a rejected request stops showing as a badge in LISTS (it stays in the order's detail and timeline). */
export const REJECTED_BADGE_DAYS = 7

/** ONE wording per state (admin vs customer). Request statuses and return stages both read from here. */
const STAGE_COPY: Record<ReturnStageKey, { step: 1 | 2 | 3 | 4; tone: ReturnStageTone; label: string; customerLabel: string; detail: string; customerDetail: string }> = {
  requested: {
    step: 1, tone: "info", label: "Return requested", customerLabel: "Return requested",
    detail: "Waiting for your decision", customerDetail: "Waiting for the shop to approve your request",
  },
  approved: {
    step: 2, tone: "progress", label: "Return approved", customerLabel: "Return approved",
    detail: "Waiting for the goods to come back", customerDetail: "Send the items back as the shop asked",
  },
  picked_up: {
    step: 2, tone: "progress", label: "Pickup successful", customerLabel: "Pickup successful",
    detail: "Picked up, waiting for the goods to reach you", customerDetail: "We have collected your items. Your refund follows once they reach us",
  },
  rejected: {
    step: 1, tone: "danger", label: "Return rejected", customerLabel: "Return not approved",
    detail: "Rejected", customerDetail: "The shop couldn't approve this return",
  },
  withdrawn: {
    step: 1, tone: "neutral", label: "Return cancelled", customerLabel: "Return cancelled",
    detail: "The customer cancelled the request", customerDetail: "You cancelled this request",
  },
  received: {
    step: 3, tone: "success", label: "Returned item received", customerLabel: "Returned item received",
    detail: "Goods back, no refund recorded yet. Use “I have refunded” on the return below, or “Refund the returned items” in the status dropdown",
    customerDetail: "We have received your returned item(s). Your refund will follow",
  },
  exchange_dispatched: {
    step: 3, tone: "progress", label: "Exchange dispatched", customerLabel: "Exchange item on the way",
    detail: "Replacement / exchanged item dispatched to customer. Mark delivered once received",
    customerDetail: "Your replacement / exchanged item is on the way",
  },
  exchange_completed: {
    step: 4, tone: "success", label: "Exchange complete", customerLabel: "Exchange complete",
    detail: "Replacement / exchanged item delivered to customer",
    customerDetail: "Your replacement / exchanged item has been delivered",
  },
  partly_refunded: {
    step: 4, tone: "progress", label: "Return part-refunded", customerLabel: "Partially refunded",
    detail: "Part of the money refunded", customerDetail: "Part of your refund has been sent",
  },
  refunded: {
    step: 4, tone: "success", label: "Return refunded", customerLabel: "Refunded",
    detail: "Goods back, full refund recorded", customerDetail: "Your refund is complete",
  },
}

/** Label + tone of a return REQUEST's own status (the small pill on each request), from the same table as the stages. */
export function requestStatusMeta(
  status: ReturnRequestStatus,
  audience: "admin" | "customer",
  resolutionType?: ReturnResolutionType,
  exchangePreference?: string | null,
  exchangeStatus?: ExchangeFulfillmentStatus | null
): { label: string; tone: ReturnStageTone } {
  if (resolutionType === "exchange" && status === "received") {
    const isRep = isReplacementPref(exchangePreference)
    if (exchangeStatus === "delivered") {
      return {
        label: isRep ? "Replacement delivered" : "Exchange complete",
        tone: "success",
      }
    }
    if (exchangeStatus === "dispatched") {
      return {
        label: isRep ? (audience === "admin" ? "Replacement dispatched" : "Replacement on the way") : audience === "admin" ? "Exchange dispatched" : "Exchange on the way",
        tone: "progress",
      }
    }
    return {
      label: "Returned item received",
      tone: "progress",
    }
  }
  const c = STAGE_COPY[status] // request statuses are stage keys too (picked_up is derived, not a status)
  const raw = audience === "admin" ? c.label : c.customerLabel
  const word = resolutionType === "exchange" ? (isReplacementPref(exchangePreference) ? "Replacement" : "Exchange") : "Return"
  const label = resolutionType === "exchange" ? raw.replace(/^Return\b/, word) : raw
  return { label, tone: c.tone }
}

export type ReturnStageInput = {
  requests: {
    status: ReturnRequestStatus
    requestedBy?: "customer" | "admin"
    createdAt: string
    decidedAt?: string | null
    adminNote?: string | null
    pickupDate?: string | null
    pickedUpAt?: string | null
    resolutionType?: ReturnResolutionType
    exchangePreference?: string | null
    exchangeMode?: "standard" | "doorstep"
    exchangeStatus?: ExchangeFulfillmentStatus | null
    exchangeShippedAt?: string | null
    exchangeDeliveredAt?: string | null
    exchangeTracking?: string | null
    exchangeShipping?: ShippingDetails | null
  }[]
  /** `refundAmount` (item value refunded for that return) is admin-only data; guests don't have it. */
  returns: { refunded: boolean; createdAt: string; refundAmount?: number | null; resolutionType?: ReturnResolutionType }[]
  paymentStatus: PaymentStatus
  /** Money already returned. Guests don't get it from the track RPC (0), so `returns[].refunded` is used too. */
  refundedAmount: number
  /** What was paid (payment_amount ?? total); only used for the admin sentence "₹X of ₹Y". */
  paidAmount: number
  /** The clock, for the "rejected badge expires" rule in lists. Omit for "always show". */
  now?: Date
}

export type ReturnStage = {
  key: ReturnStageKey
  /** 1 = requested … 4 = refund. A rejected / withdrawn request stops at its step. */
  step: 1 | 2 | 3 | 4
  tone: ReturnStageTone
  /** Admin wording. */
  label: string
  /** Customer wording (also safe for guests). */
  customerLabel: string
  /** Admin one-liner (may contain amounts). */
  detail: string
  /** Customer one-liner. Never contains amounts or addresses (the guest track page shows it). */
  customerDetail: string
  /** Still moving (needs somebody to act or wait). False for rejected / withdrawn / fully refunded. */
  active: boolean
  /** Show a badge in lists? Withdrawn requests, and rejected ones older than REJECTED_BADGE_DAYS, are history, not news. */
  badge: boolean
  /** Who initiated the latest return/exchange request (or 'admin' for direct admin-recorded returns). */
  requestedBy?: "customer" | "admin"
  /** True when the return was recorded directly by admin without a prior request. */
  directReturn?: boolean
}

/** Builds the input from a fully loaded order (OrderWithHistory or TrackedOrder). */
export function stageInputOf(
  o: {
    returnRequests: ReturnStageInput["requests"]
    returns: ReturnStageInput["returns"]
    paymentStatus: PaymentStatus
    refundedAmount: number
    paymentAmount: number | null
    total: number
  },
  now?: Date
): ReturnStageInput {
  return {
    requests: o.returnRequests,
    returns: o.returns,
    paymentStatus: o.paymentStatus,
    refundedAmount: o.refundedAmount,
    paidAmount: o.paymentAmount ?? o.total,
    now,
  }
}

const asTime = (iso: string) => Date.parse(iso)
const latest = <T extends { createdAt: string }>(rows: T[]): T | undefined =>
  rows.length ? rows.reduce((a, b) => (asTime(a.createdAt) >= asTime(b.createdAt) ? a : b)) : undefined

function refundState(i: ReturnStageInput): "none" | "partly" | "full" {
  if (i.paymentStatus === "refunded") return "full"
  if (i.refundedAmount > 0 || i.returns.some((r) => r.refunded)) return "partly"
  return "none"
}

const stage = (key: ReturnStageKey, extra: Partial<ReturnStage> = {}): ReturnStage => ({
  key,
  ...STAGE_COPY[key],
  active: key === "requested" || key === "approved" || key === "picked_up" || key === "received" || key === "exchange_dispatched" || key === "partly_refunded",
  badge: key !== "withdrawn",
  ...extra,
})

/** The one return stage of an order, or null when it has no return activity at all. */
export function returnStage(input: ReturnStageInput): ReturnStage | null {
  const request = latest(input.requests)
  const hasReturns = input.returns.length > 0 || request?.status === "received"
  const isExchangeReq = request?.resolutionType === "exchange"
  const isRepReq = isExchangeReq && isReplacementPref(request?.exchangePreference)
  const isDoorstepReq = isExchangeReq && request?.exchangeMode === "doorstep"
  const exWord = isRepReq ? "Replacement" : "Exchange"
  const reqActor: "customer" | "admin" = request ? (request.requestedBy ?? "customer") : "admin"
  const isDirectReturn = !request && input.returns.length > 0
  const withActor = (s: ReturnStage): ReturnStage => ({
    ...s,
    requestedBy: reqActor,
    ...(isDirectReturn ? { directReturn: true } : {}),
  })

  // An open request (waiting for a decision / for the goods) is what needs attention, even after an earlier return.
  if (request?.status === "requested") {
    return withActor(
      stage(
        "requested",
        isExchangeReq
          ? {
              label: `${exWord} requested`,
              customerLabel: `${exWord} requested`,
              customerDetail: isRepReq
                ? "Waiting for the shop to approve your same-item replacement"
                : "Waiting for the shop to approve your exchange request",
            }
          : {}
      )
    )
  }
  if (request?.status === "approved") {
    if (request.pickedUpAt) {
      return withActor(
        stage(
          "picked_up",
          isExchangeReq
            ? {
                customerDetail: isRepReq
                  ? "Old item collected. Once it reaches us and is checked, your fresh replacement (same size & colour) will be dispatched"
                  : "Old item collected. Once it reaches us and passes quality check, your new variant will be dispatched",
              }
            : {}
        )
      )
    }
    const on = request.pickupDate ? formatDate(request.pickupDate) : null
    if (isDoorstepReq) {
      return withActor(
        stage("approved", {
          label: isRepReq ? "Doorstep replacement" : "Doorstep exchange",
          customerLabel: isRepReq ? "Doorstep replacement" : "Doorstep exchange",
          detail: on
            ? `Doorstep handover expected by ${on}. Mark complete once the agent swaps the items`
            : "Doorstep handover approved. Mark complete once the agent swaps the items",
          customerDetail: on
            ? `Doorstep ${exWord.toLowerCase()} expected by ${on}. Our partner will deliver the new item and collect the old item together`
            : `Doorstep ${exWord.toLowerCase()} approved. Our partner will deliver the new item and collect the old item together`,
        })
      )
    }
    return withActor(
      stage("approved", {
        ...(isExchangeReq ? { label: `${exWord} approved`, customerLabel: `${exWord} approved` } : {}),
        ...(on
          ? {
              detail: `Expected pickup by ${on}`,
              customerDetail: isExchangeReq
                ? `Expected pickup by ${on}. Keep the old item packed and ready`
                : `Expected pickup by ${on}. Keep the items ready`,
            }
          : {}),
      })
    )
  }

  const refund = hasReturns ? refundState(input) : "none"
  const latestReturnAt = input.returns.reduce((max, r) => Math.max(max, asTime(r.createdAt)), 0)
  const rejectedAfterReturns =
    request?.status === "rejected" &&
    refund !== "full" &&
    (!hasReturns || asTime(request.decidedAt ?? request.createdAt) > latestReturnAt)

  if (rejectedAfterReturns) {
    const why = request.adminNote?.trim()
    const decided = asTime(request.decidedAt ?? request.createdAt)
    const stale = input.now ? input.now.getTime() - decided > REJECTED_BADGE_DAYS * 86_400_000 : false
    return withActor(
      stage("rejected", {
        ...(isExchangeReq ? { label: `${exWord} rejected`, customerLabel: `${exWord} not approved` } : {}),
        detail: why ? `Reason: ${why}` : STAGE_COPY.rejected.detail,
        customerDetail: why ? `Reason: ${why}` : isExchangeReq ? `The shop couldn't approve this ${exWord.toLowerCase()}` : STAGE_COPY.rejected.customerDetail,
        badge: !stale,
      })
    )
  }

  if (hasReturns) {
    if (refund === "full") return withActor(stage("refunded"))
    const latestReturn = latest(input.returns)
    const hasUnrefundedReturn = input.returns.some((r) => !r.refunded && r.resolutionType !== "exchange")
    const latestIsExchange =
      latestReturn?.resolutionType === "exchange" ||
      (input.returns.length > 0 && input.returns.every((r) => r.resolutionType === "exchange")) ||
      (isExchangeReq && input.returns.every((r) => !r.refunded && r.resolutionType !== "refund"))
    if (latestIsExchange && (!request || !latestReturn || asTime(latestReturn.createdAt) >= asTime(request.createdAt))) {
      const exStatus = request?.exchangeStatus ?? (request?.exchangeDeliveredAt ? "delivered" : request?.exchangeShippedAt ? "dispatched" : null)
      const tracking = request?.exchangeTracking?.trim()
      if (exStatus === "delivered") {
        return withActor(
          stage("exchange_completed", {
            label: isRepReq ? "Replacement delivered" : "Exchange complete",
            customerLabel: isRepReq ? "Replacement delivered" : "Exchange complete",
            detail: isRepReq ? "Fresh same-item replacement delivered to customer" : "Exchanged item delivered to customer",
            customerDetail: isRepReq
              ? "Your replacement (same item, same size & colour) has been delivered"
              : "Your exchanged item has been delivered — exchange complete",
            active: false,
          })
        )
      }
      if (exStatus === "dispatched") {
        return withActor(
          stage("exchange_dispatched", {
            label: isRepReq ? "Replacement dispatched" : "Exchange dispatched",
            customerLabel: isRepReq ? "Replacement on the way" : "Exchange item on the way",
            detail: tracking
              ? `Dispatched (${tracking}). Mark delivered once customer receives it`
              : `${exWord} dispatched to customer. Mark delivered once received`,
            customerDetail: tracking
              ? `Your ${isRepReq ? "fresh replacement" : "exchanged item"} is on the way (${tracking})`
              : `Your ${isRepReq ? "fresh replacement (same item, same size & colour)" : "exchanged item"} is on the way`,
            active: true,
          })
        )
      }
      return withActor(
        stage("received", {
          step: 3,
          tone: "progress",
          label: "Returned item received",
          customerLabel: "Returned item received",
          detail: isRepReq
            ? "Returned item received. Dispatch the fresh same-item replacement from the status dropdown"
            : "Returned item received & checked. Dispatch the requested variant from the status dropdown",
          customerDetail: isRepReq
            ? "We received your returned item and are preparing your fresh same-item replacement"
            : "We received your returned item and checked it. Your new variant is being prepared for dispatch",
          active: true,
        })
      )
    }
    if (refund === "partly") {
      const money =
        input.refundedAmount > 0 && input.paidAmount > 0
          ? `${formatPrice(input.refundedAmount)} of ${formatPrice(input.paidAmount)} refunded`
          : STAGE_COPY.partly_refunded.detail
      return withActor(stage("partly_refunded", { detail: money, active: hasUnrefundedReturn }))
    }
    return withActor(stage("received"))
  }

  if (request?.status === "withdrawn") {
    return withActor(stage("withdrawn", isExchangeReq ? { label: "Exchange cancelled", customerLabel: "Exchange cancelled" } : {}))
  }
  return null
}

export const stageLabel = (s: ReturnStage, audience: "admin" | "customer") => (audience === "admin" ? s.label : s.customerLabel)
export const stageDetail = (s: ReturnStage, audience: "admin" | "customer") => (audience === "admin" ? s.detail : s.customerDetail)

/** Can the customer send a NEW return request? Window open and nothing open (the DB allows a new one after a rejection). */
export const canRequestAgain = (requests: Pick<ReturnRequest, "status">[], windowOpen: boolean): boolean =>
  windowOpen && !requests.some(isOpenRequest)

/**
 * The one-line status under an order's headline for CUSTOMERS and guests (never an amount). A delivered order
 * with a return says where the return is instead of "Delivered — enjoy!".
 */
export function customerStatusLine(orderDescription: string, s: ReturnStage | null, opts: { canRequestAgain?: boolean } = {}): string {
  if (!s || s.key === "withdrawn") return /[.!?]$/.test(orderDescription) ? orderDescription : `${orderDescription}.`
  const isRep = s.customerLabel.startsWith("Replacement") || s.customerDetail.includes("same-item replacement")
  const isExchange = isRep || s.customerLabel.startsWith("Exchange") || s.customerDetail.includes("exchange") || s.customerDetail.includes("variant")
  const kind = isRep ? "Replacement" : "Exchange"
  switch (s.key) {
    case "requested":
      return isExchange ? `Your ${kind.toLowerCase()} request is being reviewed.` : "Your return is being reviewed."
    case "approved":
      if (s.customerDetail.startsWith("Doorstep")) return `${s.customerDetail}.`
      return s.customerDetail.startsWith("Expected pickup") || s.customerDetail.startsWith("Pickup scheduled")
        ? `${isExchange ? `${kind} approved` : "Return approved"}. ${s.customerDetail}.`
        : isExchange
          ? `${kind} approved — send the old item back as asked.`
          : "Return approved — send the items back as asked."
    case "picked_up":
      return isRep
        ? "Returned item picked up. Your fresh replacement (same size & colour) will be dispatched once we receive it."
        : isExchange
          ? "Returned item picked up. Your new variant will be dispatched once we receive and check it."
          : "Pickup successful. Your refund follows once we receive the items."
    case "received":
      return isRep
        ? "We received your returned item and are preparing your fresh same-item replacement."
        : isExchange
          ? "We received your returned item and checked it. Your new variant is being prepared for dispatch."
          : "We have received your returned item(s). Your refund will follow."
    case "exchange_dispatched":
      return `${s.customerDetail}.`
    case "exchange_completed":
      return `${s.customerDetail}.`
    case "partly_refunded":
      return "Part of your refund has been sent."
    case "refunded":
      return "Your return is complete and the refund has been sent."
    case "rejected": {
      const again = opts.canRequestAgain === undefined ? "" : opts.canRequestAgain ? " You can send a new request." : " The return window has ended."
      return `${s.customerDetail.replace(/\.$/, "")}.${again}`
    }
  }
}

export type ReturnTimelineEntry = {
  key: "requested" | "approved" | "pickup" | "picked_up" | "rejected" | "withdrawn" | "received" | "exchange_dispatched" | "exchange_completed" | "refund"
  label: string
  customerLabel: string
  /** ISO time it happened; null while still to come (or unknown). */
  at: string | null
  /** Admin note shown with the entry (pickup instructions / rejection reason). */
  note: string | null
  /** Admin-only extra line (may contain amounts), e.g. "Refunded ₹300 · No refund recorded" per return. Never shown to guests. */
  adminDetail?: string | null
  /** Structured outbound courier details for dispatched replacement/exchange items. */
  shipping?: ShippingDetails | null
  state: "done" | "current" | "upcoming" | "stopped"
}

/** Per-return refund state for the admin ("Refunded ₹X" / "No refund recorded"), oldest return first. */
export function returnRefundSummary(returns: ReturnStageInput["returns"]): string | null {
  if (returns.length === 0) return null
  const sorted = returns.toSorted((a, b) => asTime(a.createdAt) - asTime(b.createdAt))
  return sorted
    .map((r, i) => {
      const what = r.refunded
        ? r.refundAmount
          ? `Refunded ${formatPrice(r.refundAmount)}`
          : "Refunded"
        : r.resolutionType === "exchange"
          ? "Returned for exchange"
          : "No refund recorded"
      return sorted.length > 1 ? `Return ${i + 1}: ${what}` : what
    })
    .join(" · ")
}

/**
 * The steps of the return as a short timeline, for the admin page, the customer's order page and the
 * guest track page. Amounts are never part of it (guest safe).
 */
export function returnTimeline(input: ReturnStageInput): ReturnTimelineEntry[] {
  const stage = returnStage(input)
  if (!stage) return []
  const request = latest(input.requests)
  const lastReturn = latest(input.returns)
  const entries: ReturnTimelineEntry[] = []
  const open = stage.key === "requested" || stage.key === "approved" || stage.key === "picked_up"
  const stopped = stage.key === "rejected" || stage.key === "withdrawn"

  // A rejected / withdrawn request that was followed by goods recorded another way is not part of the story any more:
  // only a live or completed request gets the request, approval and pickup steps.
  const stepRequest = stopped ? request : latest(input.requests.filter((q) => q.status !== "rejected" && q.status !== "withdrawn"))
  const isExchange = stepRequest?.resolutionType === "exchange"
  const isRep = isExchange && isReplacementPref(stepRequest?.exchangePreference)
  const isDoorstep = isExchange && stepRequest?.exchangeMode === "doorstep"
  const exWord = isRep ? "Replacement" : "Exchange"

  // a request exists for every stage except "goods recorded directly by the admin"
  if (stepRequest) {
    entries.push({
      key: "requested",
      label: isExchange ? `${exWord} requested` : "Return requested",
      customerLabel: isExchange ? `${exWord} requested` : "Return requested",
      at: stepRequest.createdAt,
      note:
        isExchange && stepRequest.exchangePreference
          ? `${isRep ? "Promise" : "Preference"}: ${stepRequest.exchangePreference.replace(/^(Replacement|Exchange)\s*:\s*/i, "")}`
          : null,
      state: "done",
    })
  }

  if (stopped) {
    entries.push(
      stage.key === "rejected"
        ? {
            key: "rejected",
            label: isExchange ? `${exWord} rejected` : "Return rejected",
            customerLabel: isExchange ? `${exWord} not approved` : "Return not approved",
            at: request?.decidedAt ?? request?.createdAt ?? null,
            note: request?.adminNote?.trim() || null,
            state: "stopped",
          }
        : {
            key: "withdrawn",
            label: isExchange ? `${exWord} cancelled` : "Return cancelled",
            customerLabel: isExchange ? `${exWord} cancelled` : "Return cancelled",
            at: request?.decidedAt ?? request?.createdAt ?? null,
            note: null,
            state: "stopped",
          }
    )
    return entries
  }

  // approval (skipped when the admin recorded goods without any request)
  if (stepRequest) {
    const request = stepRequest
    const approved = stage.key !== "requested"
    entries.push({
      key: "approved",
      label: approved ? (isDoorstep ? `Doorstep ${exWord.toLowerCase()} approved` : isExchange ? `${exWord} approved` : "Return approved") : "Approval",
      customerLabel: approved ? (isDoorstep ? `Doorstep ${exWord.toLowerCase()} approved` : isExchange ? `${exWord} approved` : "Return approved") : "Waiting for approval",
      at: approved ? (request.decidedAt ?? null) : null,
      note: approved ? (request.adminNote?.trim() || null) : null,
      state: approved ? "done" : "current",
    })
    if (isDoorstep) {
      const completed = stage.key === "exchange_completed"
      entries.push({
        key: "pickup",
        label: "Doorstep handover scheduled",
        customerLabel: "Doorstep exchange scheduled",
        at: null,
        note: request.pickupDate ? `Expected by ${formatDate(request.pickupDate)}` : null,
        shipping: request.exchangeShipping ?? null,
        state: completed ? "done" : "current",
      })
      entries.push({
        key: "exchange_completed",
        label: isRep ? "Replacement delivered" : "Exchange complete",
        customerLabel: isRep ? "Replacement delivered" : "Exchange complete",
        at: request.exchangeDeliveredAt ?? lastReturn?.createdAt ?? null,
        note: completed ? "Old item collected & new item handed over" : null,
        state: completed ? "done" : "upcoming",
      })
      return entries
    }
    // Myntra-style pickup steps: scheduled (with the date) -> successful
    const waiting = stage.key === "requested"
    const pickedUp = !waiting && stage.key !== "approved"
    entries.push({
      key: "pickup", label: "Pickup scheduled", customerLabel: waiting ? "Pickup to be scheduled" : "Pickup scheduled", at: null,
      note: !waiting && request.pickupDate ? `Expected pickup by ${formatDate(request.pickupDate)}` : null,
      state: waiting ? "upcoming" : pickedUp ? "done" : "current",
    })
    entries.push({
      key: "picked_up", label: "Item picked up", customerLabel: "Item picked up",
      at: request.pickedUpAt ?? null, note: null,
      state: stage.key === "picked_up" ? "current" : pickedUp ? "done" : "upcoming",
    })
  }

  if (open) {
    entries.push({ key: "received", label: "Returned item received", customerLabel: "Returned item received", at: null, note: null, state: "upcoming" })
    if (isExchange) {
      entries.push({
        key: "exchange_dispatched",
        label: isRep ? "Replacement dispatched" : "Exchange dispatched",
        customerLabel: isRep ? "Replacement dispatched" : "New variant dispatched",
        at: null,
        note: null,
        state: "upcoming",
      })
      entries.push({
        key: "exchange_completed",
        label: isRep ? "Replacement delivered" : "Exchange complete",
        customerLabel: isRep ? "Replacement delivered" : "Exchange complete",
        at: null,
        note: null,
        state: "upcoming",
      })
    } else {
      entries.push({
        key: "refund",
        label: "Refund",
        customerLabel: "Refund to follow",
        at: null,
        note: null,
        state: "upcoming",
      })
    }
    return entries
  }

  entries.push({
    key: "received",
    label: "Returned item received",
    customerLabel: "Returned item received",
    at: lastReturn?.createdAt ?? null,
    note: null,
    adminDetail: returnRefundSummary(input.returns),
    state: "done",
  })
  const refund = refundState(input)
  if (isExchange) {
    const dispatched = stage.key === "exchange_dispatched" || stage.key === "exchange_completed"
    const delivered = stage.key === "exchange_completed"
    entries.push({
      key: "exchange_dispatched",
      label: isRep ? "Replacement dispatched" : "Exchange dispatched",
      customerLabel: isRep ? "Replacement dispatched" : "New variant dispatched",
      at: stepRequest?.exchangeShippedAt ?? null,
      note: stepRequest?.exchangeShipping ? null : (stepRequest?.exchangeTracking?.trim() || null),
      shipping: stepRequest?.exchangeShipping ?? null,
      state: delivered ? "done" : dispatched ? "current" : "upcoming",
    })
    entries.push({
      key: "exchange_completed",
      label: isRep ? "Replacement delivered" : "Exchange complete",
      customerLabel: isRep ? "Replacement delivered" : "Exchange complete",
      at: stepRequest?.exchangeDeliveredAt ?? null,
      note: null,
      state: delivered ? "done" : "upcoming",
    })
    return entries
  }
  const hasUnrefundedReturn = input.returns.some((r) => !r.refunded && r.resolutionType !== "exchange")
  entries.push({
    key: "refund",
    label: refund === "full" ? "Refunded" : refund === "partly" ? "Partly refunded" : "Refund",
    customerLabel: refund === "full" ? "Refunded" : refund === "partly" ? "Partially refunded" : "Refund to follow",
    at: null,
    note: null,
    state: refund === "full" || (refund === "partly" && !hasUnrefundedReturn) ? "done" : refund === "partly" ? "current" : "upcoming",
  })
  return entries
}
