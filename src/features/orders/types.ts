import { formatPhoneDisplay, formatPrice } from "@/lib/format"
import { returnStage, type ReturnStage } from "./returns"

export const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "packed",
  "shipped",
  "delivered",
  "cancelled",
] as const

export type OrderStatus = (typeof ORDER_STATUSES)[number]

export const STATUS_META: Record<
  OrderStatus,
  { label: string; description: string; tone: "neutral" | "info" | "progress" | "success" | "danger" }
> = {
  pending: { label: "Pending", description: "Order placed. We're verifying your UPI payment to confirm it", tone: "neutral" },
  confirmed: { label: "Confirmed", description: "Order confirmed and being prepared", tone: "info" },
  packed: { label: "Packed", description: "Packed with care and ready to ship", tone: "progress" },
  shipped: { label: "Shipped", description: "On its way to you", tone: "progress" },
  delivered: { label: "Delivered", description: "Delivered — enjoy!", tone: "success" },
  cancelled: { label: "Cancelled", description: "This order was cancelled", tone: "danger" },
}

export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === "string" && (ORDER_STATUSES as readonly string[]).includes(value)
}

// ---------------------------------------------------------------------------
// Payment
// ---------------------------------------------------------------------------
export const PAYMENT_STATUSES = ["pending", "submitted", "paid", "failed", "refunded"] as const
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]

/** Cash on delivery is deliberately not supported: customers pay before the order is confirmed. */
export const PAYMENT_METHODS = ["upi", "bank_transfer", "card", "cash", "other"] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  pending: "Awaiting payment",
  submitted: "Submitted, to verify",
  paid: "Paid",
  failed: "Rejected",
  refunded: "Refunded",
}

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  upi: "UPI",
  bank_transfer: "Bank transfer",
  card: "Card",
  cash: "Cash",
  other: "Other",
}

/** Customer-facing one-liner for the payment state. */
export function describePayment(status: PaymentStatus, method: PaymentMethod | null): string {
  switch (status) {
    case "paid":
      return method ? `Paid via ${PAYMENT_METHOD_LABEL[method]}` : "Paid"
    case "submitted":
      return "Payment submitted, verifying"
    case "failed":
      return "Payment not verified"
    case "refunded":
      return "Refunded"
    case "pending":
      return "Payment pending"
  }
}

export type PaymentTone = PaymentStatus | "cancelled" | "refund_due"

/**
 * What to show for an order's payment, taking the ORDER status into account: a cancelled order
 * must never say "awaiting payment". Use this everywhere a payment status is displayed.
 */
export function paymentDisplay(
  orderStatus: OrderStatus,
  status: PaymentStatus,
  method: PaymentMethod | null,
  /** Partial refund info: shown as "Partially refunded ₹X of ₹Y" while the payment is still 'paid'. */
  refund?: { refundedAmount: number; paidAmount: number }
): { label: string; tone: PaymentTone } {
  if (orderStatus === "cancelled") {
    if (status === "paid") return { label: "Paid · refund due", tone: "refund_due" }
    if (status === "submitted") return { label: "Payment sent · refund if received", tone: "refund_due" }
    if (status === "refunded") return { label: "Refunded", tone: "refunded" }
    return { label: "No payment due", tone: "cancelled" }
  }
  if (status === "paid" && refund && refund.refundedAmount > 0) {
    return {
      label: `Partially refunded ${formatPrice(refund.refundedAmount)} of ${formatPrice(refund.paidAmount)}`,
      tone: "refunded",
    }
  }
  return { label: describePayment(status, method), tone: status }
}

/**
 * True while the customer still has to pay: order pending and payment pending/rejected. A cancelled
 * order is never "awaiting payment". SQL twins: expire_unpaid_orders() and the 'awaiting-payment'
 * view in admin-queries.ts (applyOrderView).
 */
export function isAwaitingPayment(order: { status: OrderStatus; paymentStatus: PaymentStatus }): boolean {
  return order.status === "pending" && (order.paymentStatus === "pending" || order.paymentStatus === "failed")
}

/** Can the admin still verify / reject / record a payment? On a cancelled order, a submitted payment can still be verified or rejected. */
export function canVerifyPayment(order: { status: OrderStatus; paymentStatus: PaymentStatus }): boolean {
  if (order.status === "cancelled") return order.paymentStatus === "submitted"
  return order.paymentStatus !== "paid" && order.paymentStatus !== "refunded"
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------
export type OrderItem = {
  productId: string
  name: string
  slug: string
  price: number
  quantity: number
  image: string | null
}

export type StatusHistoryEntry = { status: OrderStatus; changedAt: string }

export type ShippingDetails = {
  carrier: string
  trackingNumber: string | null
  trackingUrl: string | null
  /** ISO date only, e.g. "2026-11-08" */
  expectedDelivery: string | null
}

/** An extra charge on an order (added once per product), with the product it belongs to and why. */
export type OrderFee = {
  label: string
  amount: number
  productId?: string
  productName?: string
  reason?: string | null
}

/** The price breakdown saved with an order. */
export type OrderPricing = {
  /** Items total. */
  subtotal: number
  /** Delivery charge payable (0 if waived). */
  shippingFee: number
  /** Delivery charge before the free-delivery waiver. */
  shippingFeeOriginal: number
  extraFees: OrderFee[]
  /** What the customer pays: subtotal + delivery + extra charges. */
  total: number
}

export type OrderPayment = {
  paymentStatus: PaymentStatus
  paymentMethod: PaymentMethod | null
  /** UPI reference (UTR) the customer submitted. */
  paymentReference: string | null
  /** Amount the admin recorded as received. */
  paymentAmount: number | null
  paymentSubmittedAt: string | null
  paymentPaidAt: string | null
  /** Customer-visible remark, e.g. why a payment was rejected. */
  paymentNote: string | null
  /** Money already returned for a paid order (partial refund). 0 when none. */
  refundedAmount: number
}

/** Delivery details that can still be edited while the order is pending. */
export type DeliveryDetails = {
  name: string
  phone: string
  address: string
  city: string
  pincode: string
  note: string | null
}

/** Why and by whom an order was cancelled, and whether the money was returned. */
export type Cancellation = {
  reason: string | null
  by: "customer" | "admin" | "system" | null
  at: string | null
  refundReference: string | null
  refundedAt: string | null
}

/** Goods that came back for a delivered order (recorded by the admin). */
export type OrderReturn = {
  id: string
  /** `restock` is only meaningful to the admin (was it put back on sale?). */
  items: { productId: string; name: string; quantity: number; restock?: boolean }[]
  reason: string | null
  refunded: boolean
  /** Item value refunded for THIS return (admin only: guests don't get it). null = no refund recorded. */
  refundAmount?: number | null
  createdAt: string
}

export const RETURN_REQUEST_STATUSES = ["requested", "approved", "rejected", "withdrawn", "received"] as const
export type ReturnRequestStatus = (typeof RETURN_REQUEST_STATUSES)[number]

/** A customer's request to send items back. The admin approves or rejects it. */
export type ReturnRequest = {
  id: string
  items: { productId: string; name: string; quantity: number }[]
  reason: string
  details: string | null
  status: ReturnRequestStatus
  /** Shown to the customer: pickup / shipping instructions, or the reason for a rejection. */
  adminNote: string | null
  createdAt: string
  decidedAt: string | null
  /** Day the goods are collected (set when approving; null on older requests). */
  pickupDate: string | null
  /** When the pickup actually happened (null until the admin marks it). */
  pickedUpAt: string | null
}

/** Immutable seller & GST details captured when the order was created, so past invoices never drift when settings change. */
export type OrderTaxSnapshot = {
  gstRegistered: boolean
  gstin: string | null
  gstRate: number
  legalName: string | null
  businessAddress: string | null
  shopName: string
  city: string | null
  region: string | null
  phone: string | null
  whatsappNumber: string | null
  email: string | null
}

export type Order = {
  id: string
  orderCode: string
  userId: string | null
  customerName: string
  phone: string
  address: string
  city: string
  pincode: string
  note: string | null
  items: OrderItem[]
  status: OrderStatus
  adminNote: string | null
  shipping: ShippingDetails | null
  cancellation: Cancellation | null
  deliveryUpdatedAt: string | null
  /** Null on older orders placed before migration 0046; InvoiceDocument then falls back to current StoreSettings. */
  taxSnapshot?: OrderTaxSnapshot | null
  /**
   * Where the order's return is (requested / approved / received / refunded …), derived from the return rows.
   * null = no return activity, OR the query didn't embed return rows (list queries must embed them).
   */
  returnStage: ReturnStage | null
  createdAt: string
  updatedAt: string
} & OrderPricing &
  OrderPayment

export type OrderWithHistory = Order & { history: StatusHistoryEntry[]; returns: OrderReturn[]; returnRequests: ReturnRequest[] }

/** Public tracking result (no address / phone exposed). */
export type TrackedOrder = {
  orderCode: string
  status: OrderStatus
  items: OrderItem[]
  city: string
  createdAt: string
  shipping: ShippingDetails | null
  cancellation: Cancellation | null
  /** Present only while the order is pending (still editable). */
  delivery: DeliveryDetails | null
  history: StatusHistoryEntry[]
  returns: OrderReturn[]
  returnRequests: ReturnRequest[]
  /** Can the customer still ask for a return? (delivered + inside the shop's return window) */
  returnWindow: { open: boolean; until: string | null; days: number }
} & OrderPricing &
  OrderPayment

export type OrderRow = {
  id: string
  order_code: string
  user_id: string | null
  customer_name: string
  phone: string
  address: string
  city: string
  pincode: string
  note: string | null
  items: OrderItem[]
  subtotal: number | string
  status: OrderStatus
  /** Only present on admin queries that embed `order_admin_notes` (customers can never select it). */
  private_note?: { note: string } | { note: string }[] | null
  shipping_carrier: string | null
  tracking_number: string | null
  tracking_url: string | null
  expected_delivery: string | null
  shipping_fee: number | string | null
  shipping_fee_original: number | string | null
  extra_fees: RawFees
  total: number | string | null
  payment_status: PaymentStatus
  payment_method: PaymentMethod | null
  payment_reference: string | null
  payment_amount: number | string | null
  payment_submitted_at: string | null
  payment_paid_at: string | null
  payment_note: string | null
  delivery_updated_at: string | null
  tax_snapshot?: {
    gstRegistered?: boolean | null
    gstin?: string | null
    gstRate?: number | string | null
    legalName?: string | null
    businessAddress?: string | null
    shopName?: string | null
    city?: string | null
    region?: string | null
    phone?: string | null
    whatsappNumber?: string | null
    email?: string | null
  } | null
  cancel_reason: string | null
  cancelled_by: "customer" | "admin" | "system" | null
  cancelled_at: string | null
  refund_reference: string | null
  refunded_at: string | null
  refunded_amount: number | string | null
  created_at: string
  updated_at: string
  history?: { status: OrderStatus; changed_at: string }[]
  /** List queries embed only `refunded, created_at`; the detail queries embed everything. */
  returns?: { id: string; items: OrderReturn["items"]; reason: string | null; refunded: boolean; refund_amount?: number | string | null; created_at: string }[]
  return_requests?: {
    id: string
    items: ReturnRequest["items"]
    reason: string
    details: string | null
    status: ReturnRequestStatus
    admin_note: string | null
    created_at: string
    decided_at: string | null
    pickup_date?: string | null
    picked_up_at?: string | null
  }[]
}

type RawFees =
  | { label: string; amount: number | string; productId?: string; productName?: string; reason?: string | null }[]
  | null
  | undefined

export const mapFees = (fees: RawFees): OrderFee[] =>
  (fees ?? []).map((f) => ({
    label: f.label,
    amount: Number(f.amount),
    ...(f.productId ? { productId: f.productId } : {}),
    ...(f.productName ? { productName: f.productName } : {}),
    ...(f.reason ? { reason: f.reason } : {}),
  }))

/** Loosely-typed pricing + payment fields as raw JSON (numbers may arrive as strings, columns may be null). */
type RawPricing = {
  subtotal: number | string
  shippingFee?: number | string | null
  shippingFeeOriginal?: number | string | null
  extraFees?: RawFees
  total?: number | string | null
  paymentStatus?: PaymentStatus | null
  paymentMethod?: PaymentMethod | null
  paymentReference?: string | null
  paymentAmount?: number | string | null
  paymentSubmittedAt?: string | null
  paymentPaidAt?: string | null
  paymentNote?: string | null
  refundedAmount?: number | string | null
}

/** Turns raw pricing/payment fields (camelCase, e.g. from the track_order RPC) into typed numbers with defaults. */
export function normalizePricing(raw: RawPricing): OrderPricing & OrderPayment {
  const subtotal = Number(raw.subtotal)
  return {
    subtotal,
    shippingFee: Number(raw.shippingFee ?? 0),
    shippingFeeOriginal: Number(raw.shippingFeeOriginal ?? 0),
    extraFees: mapFees(raw.extraFees),
    total: Number(raw.total ?? subtotal),
    paymentStatus: raw.paymentStatus ?? "pending",
    paymentMethod: raw.paymentMethod ?? null,
    paymentReference: raw.paymentReference ?? null,
    paymentAmount: raw.paymentAmount == null ? null : Number(raw.paymentAmount),
    paymentSubmittedAt: raw.paymentSubmittedAt ?? null,
    paymentPaidAt: raw.paymentPaidAt ?? null,
    paymentNote: raw.paymentNote ?? null,
    refundedAmount: Number(raw.refundedAmount ?? 0),
  }
}

function mapPricing(row: OrderRow): OrderPricing & OrderPayment {
  return normalizePricing({
    subtotal: row.subtotal,
    shippingFee: row.shipping_fee,
    shippingFeeOriginal: row.shipping_fee_original,
    extraFees: row.extra_fees,
    total: row.total,
    paymentStatus: row.payment_status,
    paymentMethod: row.payment_method,
    paymentReference: row.payment_reference,
    paymentAmount: row.payment_amount,
    paymentSubmittedAt: row.payment_submitted_at,
    paymentPaidAt: row.payment_paid_at,
    paymentNote: row.payment_note,
    refundedAmount: row.refunded_amount,
  })
}

/** The return stage of a row that embedded its return rows (null when it didn't, or there is no return activity). */
function stageOfRow(row: OrderRow, pricing: OrderPricing & OrderPayment): ReturnStage | null {
  if (!row.return_requests && !row.returns) return null
  return returnStage({
    requests: (row.return_requests ?? []).map((r) => ({ status: r.status, createdAt: r.created_at, decidedAt: r.decided_at, adminNote: r.admin_note, pickupDate: r.pickup_date ?? null, pickedUpAt: r.picked_up_at ?? null })),
    returns: (row.returns ?? []).map((r) => ({ refunded: r.refunded, createdAt: r.created_at })),
    paymentStatus: pricing.paymentStatus,
    refundedAmount: pricing.refundedAmount,
    paidAmount: pricing.paymentAmount ?? pricing.total,
    // lets a long-rejected request drop out of list badges (REJECTED_BADGE_DAYS); lists are always rendered per request
    now: new Date(),
  })
}

function mapTaxSnapshot(raw: OrderRow["tax_snapshot"]): OrderTaxSnapshot | null {
  if (!raw || typeof raw !== "object") return null
  const whatsappNumber = raw.whatsappNumber ?? null
  const phone = raw.phone ?? (whatsappNumber ? formatPhoneDisplay(whatsappNumber) : null)
  return {
    gstRegistered: Boolean(raw.gstRegistered),
    gstin: raw.gstin ?? null,
    gstRate: Number(raw.gstRate ?? 0),
    legalName: raw.legalName ?? null,
    businessAddress: raw.businessAddress ?? null,
    shopName: raw.shopName ?? "",
    city: raw.city ?? null,
    region: raw.region ?? null,
    phone,
    whatsappNumber,
    email: raw.email ?? null,
  }
}

export function mapOrder(row: OrderRow): Order {
  const pricing = mapPricing(row)
  return {
    id: row.id,
    orderCode: row.order_code,
    userId: row.user_id,
    customerName: row.customer_name,
    phone: row.phone,
    address: row.address,
    city: row.city,
    pincode: row.pincode,
    note: row.note,
    items: (row.items ?? []).map((i) => ({ ...i, price: Number(i.price) })),
    status: row.status,
    adminNote: (Array.isArray(row.private_note) ? row.private_note[0]?.note : row.private_note?.note) ?? null,
    shipping: row.shipping_carrier
      ? {
          carrier: row.shipping_carrier,
          trackingNumber: row.tracking_number ?? null,
          trackingUrl: row.tracking_url ?? null,
          expectedDelivery: row.expected_delivery ?? null,
        }
      : null,
    cancellation:
      row.status === "cancelled"
        ? {
            reason: row.cancel_reason ?? null,
            by: row.cancelled_by ?? null,
            at: row.cancelled_at ?? null,
            refundReference: row.refund_reference ?? null,
            refundedAt: row.refunded_at ?? null,
          }
        : null,
    deliveryUpdatedAt: row.delivery_updated_at ?? null,
    taxSnapshot: mapTaxSnapshot(row.tax_snapshot),
    returnStage: stageOfRow(row, pricing),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...pricing,
  }
}

export function mapOrderWithHistory(row: OrderRow): OrderWithHistory {
  return {
    ...mapOrder(row),
    history: (row.history ?? [])
      .map((h) => ({ status: h.status, changedAt: h.changed_at }))
      .sort((a, b) => a.changedAt.localeCompare(b.changedAt)),
    returnRequests: (row.return_requests ?? [])
      .map((r) => ({
        id: r.id,
        items: r.items,
        reason: r.reason,
        details: r.details,
        status: r.status,
        adminNote: r.admin_note,
        createdAt: r.created_at,
        decidedAt: r.decided_at,
        pickupDate: r.pickup_date ?? null,
        pickedUpAt: r.picked_up_at ?? null,
      }))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    returns: (row.returns ?? [])
      .map((r) => ({
        id: r.id,
        items: r.items,
        reason: r.reason,
        refunded: r.refunded,
        refundAmount: r.refund_amount == null ? null : Number(r.refund_amount),
        createdAt: r.created_at,
      }))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
  }
}
