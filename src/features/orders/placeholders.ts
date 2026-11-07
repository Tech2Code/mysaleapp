import type { PlacedOrder } from "./actions"
import type { DashboardData } from "./admin-queries"
import { returnStage } from "./returns"
import { ORDER_STATUSES, type Order, type OrderStatus, type OrderWithHistory, type PaymentStatus, type TrackedOrder } from "./types"

/** Placeholder data for loading states (see components/shared/skeletonize.tsx). Shape only; one place per entity. */

const STATUS_CYCLE: OrderStatus[] = ["pending", "confirmed", "packed", "shipped", "delivered"]
const PAYMENT_CYCLE: PaymentStatus[] = ["submitted", "paid", "paid", "paid", "paid"]
const ITEMS = [
  { name: "Hand-painted clay diya set", price: 599 },
  { name: "Macrame wall hanging", price: 1299 },
]

export function placeholderOrder(i = 0): Order {
  const items = ITEMS.map((it, n) => ({ productId: `ph-${n}`, slug: `ph-${n}`, image: null, quantity: n + 1, ...it }))
  const subtotal = items.reduce((s, it) => s + it.price * it.quantity, 0)
  return {
    id: `ph-order-${i}`,
    orderCode: "KK-7F3K9Q",
    userId: null,
    customerName: "Customer name",
    phone: "+91 98765 43210",
    address: "12, Sample Street, Sample Nagar",
    city: "Mumbai, Maharashtra",
    pincode: "400001",
    note: null,
    items,
    status: STATUS_CYCLE[i % STATUS_CYCLE.length],
    adminNote: null,
    shipping: null,
    cancellation: null,
    deliveryUpdatedAt: null,
    returnStage: null,
    createdAt: "2026-01-01T10:00:00.000Z",
    updatedAt: "2026-01-01T10:00:00.000Z",
    subtotal,
    shippingFee: 0,
    shippingFeeOriginal: 0,
    extraFees: [],
    total: subtotal,
    paymentStatus: PAYMENT_CYCLE[i % PAYMENT_CYCLE.length],
    paymentMethod: "upi",
    paymentReference: null,
    paymentAmount: null,
    paymentSubmittedAt: null,
    paymentPaidAt: null,
    paymentNote: null,
    refundedAmount: 0,
  }
}

export const placeholderOrders = (n = 8): Order[] => Array.from({ length: n }, (_, i) => placeholderOrder(i))

export function placeholderTrackedOrder(overrides: Partial<TrackedOrder> = {}): TrackedOrder {
  const o = placeholderOrder(1)
  return {
    orderCode: o.orderCode,
    status: o.status,
    items: o.items,
    city: o.city,
    createdAt: o.createdAt,
    shipping: null,
    cancellation: null,
    delivery: null,
    history: [{ status: "pending", changedAt: o.createdAt }, { status: "confirmed", changedAt: o.createdAt }],
    returns: [],
    returnRequests: [],
    returnWindow: { open: false, until: null, days: 7 },
    subtotal: o.subtotal,
    shippingFee: 0,
    shippingFeeOriginal: 0,
    extraFees: [],
    total: o.total,
    paymentStatus: o.paymentStatus,
    paymentMethod: o.paymentMethod,
    paymentReference: null,
    paymentAmount: null,
    paymentSubmittedAt: null,
    paymentPaidAt: null,
    paymentNote: null,
    refundedAmount: 0,
    ...overrides,
  }
}

/** The order the "order placed" page shows before the real one is known. */
export const placeholderPlacedOrder = (): PlacedOrder => ({ orderCode: "KK-7F3K9Q", total: 1897, phoneLast4: "3210", whatsappUrl: "https://wa.me/" })

export function placeholderDashboard(): DashboardData {
  const days = Array.from({ length: 12 }, (_, i) => ({ date: `2026-04-${String(i + 1).padStart(2, "0")}`, label: `${i + 1} Apr`, revenue: 4000 + ((i * 1700) % 9000), orders: 2 + (i % 5) }))
  return {
    greeting: "Good morning",
    todayLabel: "Monday, 1 January",
    rangeLabel: "FY 2026-27",
    hasPrevious: true,
    days,
    revenue: { current: 125000, previous: 98000 },
    orders: { current: 84, previous: 70 },
    averageOrder: { current: 1488, previous: 1400 },
    byStatus: Object.fromEntries(ORDER_STATUSES.map((s, i) => [s, 10 + i])) as Record<OrderStatus, number>,
    attention: { toVerify: 2, awaitingPayment: 3, toFulfil: 4, returnRequests: 1, returnsToReceive: 1, refundsToSend: 1 },
    topProducts: [0, 1, 2, 3, 4].map((i) => ({ productId: `ph-${i}`, name: ITEMS[i % 2].name, image: null, quantity: 12 - i, revenue: 9000 - i * 1500 })),
    // typical healthy shop: nothing low on stock (the real page then shows one short sentence)
    lowStock: [],
    recent: placeholderOrders(6),
  }
}

/** The date-range picker's state while the dashboard loads (this financial year). */
export const placeholderDashboardRange = () => ({ key: "fy" as const, from: "2026-04-01", to: "2026-04-12", bucket: "day" as const })
export const PLACEHOLDER_TODAY = "2026-04-12"

/** A delivered order with a received return request and two recorded returns (one refunded, one not): the busiest typical order page. */
export const placeholderOrderWithHistory = (): OrderWithHistory => {
  const base = placeholderOrder(4)
  const day = (d: number) => `2026-01-${String(d).padStart(2, "0")}T10:00:00.000Z`
  const returns = [
    { id: "ph-return-1", items: [{ productId: "ph-0", name: ITEMS[0].name, quantity: 1, restock: true }], reason: "Damaged in transit", refunded: true, refundAmount: ITEMS[0].price, createdAt: day(9) },
    { id: "ph-return-2", items: [{ productId: "ph-1", name: ITEMS[1].name, quantity: 1, restock: false }], reason: "Changed my mind", refunded: false, refundAmount: null, createdAt: day(10) },
  ]
  const returnRequests = [
    { id: "ph-request-1", items: [{ productId: "ph-0", name: ITEMS[0].name, quantity: 1 }], reason: "Damaged in transit", details: "The piece arrived with a crack.", status: "received" as const, adminNote: "Send it to the studio address.", createdAt: day(7), decidedAt: day(8), pickupDate: null, pickedUpAt: null },
  ]
  return {
    ...base,
    paymentStatus: "paid",
    paymentReference: "412345678901",
    paymentAmount: base.total,
    paymentSubmittedAt: day(1),
    paymentPaidAt: day(1),
    refundedAmount: ITEMS[0].price,
    returnStage: returnStage({ requests: returnRequests, returns, paymentStatus: "paid", refundedAmount: ITEMS[0].price, paidAmount: base.total }),
    shipping: { carrier: "Delhivery", trackingNumber: "DL1234567", trackingUrl: null, expectedDelivery: "2026-01-06" },
    history: [
      { status: "pending", changedAt: day(1) },
      { status: "confirmed", changedAt: day(2) },
      { status: "packed", changedAt: day(3) },
      { status: "shipped", changedAt: day(4) },
      { status: "delivered", changedAt: day(6) },
    ],
    returns,
    returnRequests,
  }
}
