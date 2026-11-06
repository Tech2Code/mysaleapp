/**
 * Ready-made order lists used by the dashboard tiles (`/admin/orders?view=…`).
 * The tile COUNT and the list it links to both come from orderViewFilter() in admin-queries.ts,
 * so they can never disagree. Add a new view here and in that one function (incl. return-requests, whose orders come from the return_requests table).
 */
export const ORDER_VIEWS = {
  "to-verify": { label: "Payments to verify" },
  "awaiting-payment": { label: "Awaiting payment" },
  "to-ship": { label: "To pack & ship" },
  "return-requests": { label: "Return requests" },
} as const

export type OrderView = keyof typeof ORDER_VIEWS

export const isOrderView = (v: unknown): v is OrderView => typeof v === "string" && v in ORDER_VIEWS
