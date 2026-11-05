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
  pending: { label: "Pending", description: "Order placed. Complete the payment so we can confirm it", tone: "neutral" },
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
  method: PaymentMethod | null
): { label: string; tone: PaymentTone } {
  if (orderStatus === "cancelled") {
    if (status === "paid") return { label: "Paid · refund due", tone: "refund_due" }
    if (status === "submitted") return { label: "Payment sent · refund if received", tone: "refund_due" }
    if (status === "refunded") return { label: "Refunded", tone: "refunded" }
    return { label: "No payment due", tone: "cancelled" }
  }
  return { label: describePayment(status, method), tone: status }
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
  by: "customer" | "admin" | null
  at: string | null
  refundReference: string | null
  refundedAt: string | null
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
  createdAt: string
  updatedAt: string
} & OrderPricing &
  OrderPayment

export type OrderWithHistory = Order & { history: StatusHistoryEntry[] }

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
  // Added by migrations 0002 / 0003; optional so the app keeps working before they are applied.
  shipping_carrier?: string | null
  tracking_number?: string | null
  tracking_url?: string | null
  expected_delivery?: string | null
  shipping_fee?: number | string | null
  shipping_fee_original?: number | string | null
  extra_fees?: RawFees
  total?: number | string | null
  payment_status?: PaymentStatus | null
  payment_method?: PaymentMethod | null
  payment_reference?: string | null
  payment_amount?: number | string | null
  payment_submitted_at?: string | null
  payment_paid_at?: string | null
  payment_note?: string | null
  delivery_updated_at?: string | null
  cancel_reason?: string | null
  cancelled_by?: "customer" | "admin" | null
  cancelled_at?: string | null
  refund_reference?: string | null
  refunded_at?: string | null
  created_at: string
  updated_at: string
  history?: { status: OrderStatus; changed_at: string }[]
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

function mapPricing(row: OrderRow): OrderPricing & OrderPayment {
  const subtotal = Number(row.subtotal)
  return {
    subtotal,
    shippingFee: Number(row.shipping_fee ?? 0),
    shippingFeeOriginal: Number(row.shipping_fee_original ?? 0),
    extraFees: mapFees(row.extra_fees),
    total: Number(row.total ?? subtotal),
    paymentStatus: row.payment_status ?? "pending",
    paymentMethod: row.payment_method ?? null,
    paymentReference: row.payment_reference ?? null,
    paymentAmount: row.payment_amount == null ? null : Number(row.payment_amount),
    paymentSubmittedAt: row.payment_submitted_at ?? null,
    paymentPaidAt: row.payment_paid_at ?? null,
    paymentNote: row.payment_note ?? null,
  }
}

export function mapOrder(row: OrderRow): Order {
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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...mapPricing(row),
  }
}

export function mapOrderWithHistory(row: OrderRow): OrderWithHistory {
  return {
    ...mapOrder(row),
    history: (row.history ?? [])
      .map((h) => ({ status: h.status, changedAt: h.changed_at }))
      .sort((a, b) => a.changedAt.localeCompare(b.changedAt)),
  }
}
