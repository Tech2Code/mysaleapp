"use client"

import { useState } from "react"
import { CreateReturnRequest } from "@/components/admin/create-return-request"
import { AdminReturnOrder } from "@/components/admin/return-order"
import { RefundReturnButton } from "@/components/admin/refund-return-button"
import { DecideDialog, PickedUpButton, UndoStepButton } from "@/components/admin/return-requests"
import { SelectField } from "@/components/form"
import { isOpenRequest, returnableQuantities, type ReturnStage } from "@/features/orders/returns"
import type { OrderItem, OrderReturn, OrderStatus, PaymentStatus, ReturnRequest } from "@/features/orders/types"

type Choice = "current" | "approve" | "reject" | "picked_up" | "received" | "refund" | "undo" | "create"

/** Item value of one return, priced from the order's lines (what the database refunds for it). */
function returnValue(r: OrderReturn, items: OrderItem[]): number {
  return r.items.reduce((n, i) => n + i.quantity * Math.max(0, ...items.filter((o) => o.productId === i.productId).map((o) => o.price)), 0)
}

/**
 * The order status dropdown for a DELIVERED order: it lists where the order's return is now and the legal next
 * steps (approve / reject, pickup successful, items received, refund). Choosing one shows that step's button, which
 * asks for any details and a confirmation. So every status change is managed from this one dropdown.
 */
export function ReturnStatusControl({
  orderId,
  orderCode,
  customerName,
  phone,
  status,
  paymentStatus,
  refundedAmount,
  items,
  requests,
  returns,
  stage,
}: {
  orderId: string
  orderCode: string
  customerName: string
  phone: string
  status: OrderStatus
  paymentStatus: PaymentStatus
  refundedAmount: number
  items: OrderItem[]
  requests: ReturnRequest[]
  returns: OrderReturn[]
  stage: ReturnStage | null
}) {
  const [choice, setChoice] = useState<Choice>("current")
  const open = requests.find(isOpenRequest) ?? null
  const unrefunded = returns.filter((r) => !r.refunded)

  const currentLabel = stage ? `${stage.label}` : "Delivered"
  const options: { value: Choice; label: string }[] = [{ value: "current", label: currentLabel }]
  if (open?.status === "requested") options.push({ value: "approve", label: "Approve return" }, { value: "reject", label: "Reject return" })
  if (open?.status === "approved" && !open.pickedUpAt) options.push({ value: "picked_up", label: "Pickup successful" })
  // Only while something can still come back: not once everything was returned or the payment is fully refunded.
  // A request still waiting for a decision is approved or rejected first (the database refuses to close it otherwise).
  // Every return starts from an approved customer request (no "received" without one; the database refuses it too).
  const canReceive = open?.status === "approved" && paymentStatus !== "refunded" && stage?.key !== "refunded" && [...returnableQuantities(items, returns).values()].some((q) => q > 0)
  if (canReceive) options.push({ value: "received", label: "Return received (record items)" })
  if (unrefunded.length > 0 && paymentStatus === "paid") options.push({ value: "refund", label: "Refund the returned items" })
  // The customer asked outside the app: open the request for them (return window ignored), then approve it as usual.
  const canCreateRequest = !open && paymentStatus !== "refunded" && stage?.key !== "refunded" && [...returnableQuantities(items, returns).values()].some((q) => q > 0)
  if (canCreateRequest) options.push({ value: "create", label: "Create return request (customer asked outside the app)" })
  // Mis-click safety net: take back the last request step (pickup / approval / rejection). Received and refunds stay.
  const lastRequest = requests.length > 0 ? requests[requests.length - 1] : null
  const undoTarget = open?.status === "approved" ? open : !open && lastRequest?.status === "rejected" ? lastRequest : null
  const undoText = !undoTarget
    ? null
    : undoTarget.status === "rejected"
      ? { label: "Undo rejection", title: "Undo the rejection?", description: "The request goes back to “waiting for a decision”. The customer sees it as pending again." }
      : undoTarget.pickedUpAt
        ? { label: "Undo “Pickup successful”", title: "Undo the pickup?", description: "The return goes back to “pickup scheduled”." }
        : { label: "Undo approval", title: "Undo the approval?", description: "The request goes back to “waiting for a decision”. The pickup date and your note are cleared." }
  if (undoTarget && undoText) options.push({ value: "undo", label: undoText.label })

  // the chosen step can disappear after a refresh (e.g. it was just done): fall back to the current state
  const picked: Choice = options.some((o) => o.value === choice) ? choice : "current"

  return (
    <div data-ui="admin/ReturnStatusControl" className="space-y-3">
      <SelectField label="Order status" fieldSize="md" options={options} value={picked} onValueChange={(v) => setChoice(v as Choice)} />
      {stage && picked === "current" && <p data-ui="admin/ReturnStatusControl/p" className="text-sm text-muted-foreground">{stage.detail}</p>}
      {picked === "approve" && open && <DecideDialog request={open} approve orderCode={orderCode} customerName={customerName} phone={phone} />}
      {picked === "reject" && open && <DecideDialog request={open} approve={false} orderCode={orderCode} customerName={customerName} phone={phone} />}
      {picked === "picked_up" && open && <PickedUpButton requestId={open.id} />}
      {picked === "create" && <CreateReturnRequest orderId={orderId} orderCode={orderCode} items={items} returns={returns} />}
      {picked === "undo" && undoTarget && undoText && <UndoStepButton requestId={undoTarget.id} title={undoText.title} description={undoText.description} />}
      {picked === "received" && open && (
        <AdminReturnOrder
          orderId={orderId}
          orderCode={orderCode}
          status={status}
          paymentStatus={paymentStatus}
          items={items}
          returns={returns}
          prefill={{ requestId: open.id, items: open.items.map((i) => ({ productId: i.productId, quantity: i.quantity })) }}
          triggerLabel="Record the items that came back"
        />
      )}
      {picked === "refund" && (
        <ul data-ui="admin/ReturnStatusControl/ul" className="space-y-2">
          {unrefunded.map((r) => (
            <li data-ui="admin/ReturnStatusControl/li" key={r.id}>
              <RefundReturnButton returnId={r.id} value={returnValue(r, items)} expectedRefunded={refundedAmount} />
            </li>
          ))}
        </ul>
      )}
      <p data-ui="admin/ReturnStatusControl/p-2" className="text-xs text-muted-foreground">Pick the next step; its button asks for details and confirms before saving.</p>
    </div>
  )
}
