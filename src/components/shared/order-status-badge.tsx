import type { ReturnStage } from "@/features/orders/returns"
import type { OrderStatus, PaymentStatus } from "@/features/orders/types"
import { PaymentBadge } from "./payment-badge"
import { ReturnStageBadge } from "./return-stage-badge"
import { StatusBadge } from "./status-badge"

/**
 * ONE badge for an order: the LATEST thing that happened, never a pile of badges.
 *   1. a delivered order with a return -> where the return is (requested, picked up, received, refunded...)
 *   2. a still-pending order whose payment needs attention -> the payment (submitted / failed)
 *   3. otherwise -> the order status
 * The full payment state lives on the payment card; the full return story on the progress timeline.
 */
export function OrderStatusBadge({
  status,
  returnStage,
  paymentStatus,
  audience,
  className,
  pulse,
  alwaysShow = false,
}: {
  status: OrderStatus
  returnStage: ReturnStage | null
  paymentStatus: PaymentStatus
  audience: "admin" | "customer"
  className?: string
  pulse?: boolean
  /** Show the return badge even for a long-rejected / withdrawn request (detail pages). */
  alwaysShow?: boolean
}) {
  if (status === "delivered" && returnStage && (alwaysShow || returnStage.badge)) {
    return <ReturnStageBadge stage={returnStage} audience={audience} className={className} alwaysShow />
  }
  if (status === "pending" && (paymentStatus === "submitted" || paymentStatus === "failed")) {
    return <PaymentBadge status={paymentStatus} orderStatus={status} className={className} />
  }
  return <StatusBadge status={status} className={className} pulse={pulse} />
}
