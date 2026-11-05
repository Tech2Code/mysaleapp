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
  pending: { label: "Pending", description: "Order received, waiting for confirmation on WhatsApp", tone: "neutral" },
  confirmed: { label: "Confirmed", description: "Order confirmed and being prepared", tone: "info" },
  packed: { label: "Packed", description: "Packed with care and ready to ship", tone: "progress" },
  shipped: { label: "Shipped", description: "On its way to you", tone: "progress" },
  delivered: { label: "Delivered", description: "Delivered — enjoy!", tone: "success" },
  cancelled: { label: "Cancelled", description: "This order was cancelled", tone: "danger" },
}

export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === "string" && (ORDER_STATUSES as readonly string[]).includes(value)
}

export type OrderItem = {
  productId: string
  name: string
  slug: string
  price: number
  quantity: number
  image: string | null
}

export type StatusHistoryEntry = { status: OrderStatus; changedAt: string }

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
  subtotal: number
  status: OrderStatus
  adminNote: string | null
  createdAt: string
  updatedAt: string
}

export type OrderWithHistory = Order & { history: StatusHistoryEntry[] }

/** Public tracking result (no address / phone exposed). */
export type TrackedOrder = {
  orderCode: string
  status: OrderStatus
  items: OrderItem[]
  subtotal: number
  city: string
  createdAt: string
  history: StatusHistoryEntry[]
}

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
  admin_note: string | null
  created_at: string
  updated_at: string
  history?: { status: OrderStatus; changed_at: string }[]
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
    subtotal: Number(row.subtotal),
    status: row.status,
    adminNote: row.admin_note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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
