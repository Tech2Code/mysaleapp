"use client"

import { RotateCcwIcon } from "lucide-react"
import { useState } from "react"
import { CreateReturnRequest } from "@/components/admin/create-return-request"
import { RevertOrderStatusDialog } from "@/components/admin/order-controls"
import { AdminReturnOrder } from "@/components/admin/return-order"
import { RefundReturnButton } from "@/components/admin/refund-return-button"
import { DecideDialog, ExchangeFulfillmentControl, PickedUpButton, UndoStepButton } from "@/components/admin/return-requests"
import { SelectField, type SelectOption } from "@/components/form"
import { Button } from "@/components/ui/button"
import { netReturnRefund } from "@/features/orders/refund"
import { isOpenRequest, returnableQuantities, splitReturnDetails, type ReturnStage } from "@/features/orders/returns"
import type { OrderItem, OrderReturn, OrderStatus, PaymentStatus, ReturnRequest } from "@/features/orders/types"
import styles from "./admin-orders.module.css"

type Choice =
  | "current"
  | "approve"
  | "reject"
  | "picked_up"
  | "received"
  | "exchange_set_courier"
  | "exchange_dispatch"
  | "exchange_deliver"
  | "exchange_undo_dispatch"
  | "exchange_undo_deliver"
  | "refund"
  | "undo"
  | "create"
  | "revert_shipped"

/** Item value of one return, priced from the order's lines (what the database refunds for it). */
function returnValue(
  r: OrderReturn,
  items: OrderItem[],
  returns: OrderReturn[],
  discountAmount = 0,
  alreadyRefunded = 0,
  paidAmount?: number
): number {
  const prior = returns.filter((o) => o.refunded && o.id !== r.id).flatMap((o) => o.items)
  return netReturnRefund(items, r.items, { discountAmount, paidAmount, alreadyRefunded, priorReturnedLines: prior })
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
  paymentReference,
  refundedAmount,
  discountAmount = 0,
  paidAmount,
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
  paymentReference?: string | null
  refundedAmount: number
  discountAmount?: number
  paidAmount?: number
  items: OrderItem[]
  requests: ReturnRequest[]
  returns: OrderReturn[]
  stage: ReturnStage | null
}) {
  const [choice, setChoice] = useState<Choice>("current")
  const [revertOpen, setRevertOpen] = useState(false)
  const stateKey = `${requests.map((r) => `${r.id}:${r.status}:${r.pickedUpAt ?? ""}:${r.exchangeMode ?? ""}:${r.exchangeStatus ?? ""}:${r.exchangeShipping?.carrier ?? ""}:${r.exchangeShipping?.trackingNumber ?? ""}`).join(",")}|${returns.map((r) => `${r.id}:${r.refunded}`).join(",")}|${paymentStatus}`
  const [prevStateKey, setPrevStateKey] = useState(stateKey)
  if (stateKey !== prevStateKey) {
    setPrevStateKey(stateKey)
    if (choice !== "current") setChoice("current")
  }
  const open = requests.find(isOpenRequest) ?? null
  const unrefunded = returns.filter((r) => !r.refunded && r.resolutionType !== "exchange")

  const currentLabel = stage ? `${stage.label}` : "Delivered"
  const options: (SelectOption & { value: Choice })[] = [{ value: "current", label: currentLabel, tone: "current", badge: "Current" }]
  if (open?.status === "requested") {
    const isExchange = open.resolutionType === "exchange"
    options.push(
      { value: "approve", label: isExchange ? "Approve exchange" : "Approve return", tone: "next", badge: "Next step" },
      { value: "reject", label: isExchange ? "Reject exchange" : "Reject return" }
    )
  }
  const isDoorstepApproved = open?.status === "approved" && open.resolutionType === "exchange" && open.exchangeMode === "doorstep"
  if (isDoorstepApproved) {
    options.push({
      value: "exchange_set_courier",
      label: open.exchangeShipping ? "Edit doorstep courier details" : "Add doorstep courier details",
    })
  }
  if (open?.status === "approved" && !open.pickedUpAt && !isDoorstepApproved) {
    options.push({ value: "picked_up", label: "Pickup successful", tone: "next", badge: "Next step" })
  }
  // Only while something can still come back: not once everything was returned or the payment is fully refunded.
  // A request still waiting for a decision is approved or rejected first (the database refuses to close it otherwise).
  // Every return starts from an approved customer request (no "received" without one; the database refuses it too).
  // Standard returns require pickup first; doorstep exchanges complete handover in 1 click.
  const canReceive =
    open?.status === "approved" &&
    (Boolean(open.pickedUpAt) || isDoorstepApproved) &&
    paymentStatus !== "refunded" &&
    stage?.key !== "refunded" &&
    [...returnableQuantities(items, returns).values()].some((q) => q > 0)
  if (canReceive) {
    options.push({
      value: "received",
      label: isDoorstepApproved ? "Complete doorstep exchange" : "Return received (record items)",
      tone: "next",
      badge: "Next step",
    })
  }
  if (unrefunded.length > 0 && paymentStatus === "paid") options.push({ value: "refund", label: "Refund the returned items", tone: "next", badge: "Next step" })
  // The customer asked outside the app: open the request for them (return window ignored), then approve it as usual.
  const canCreateRequest = !open && paymentStatus !== "refunded" && stage?.key !== "refunded" && [...returnableQuantities(items, returns).values()].some((q) => q > 0)
  if (canCreateRequest) options.push({ value: "create", label: "Create return request (customer asked outside the app)" })
  const lastRequest = requests.length > 0 ? requests[requests.length - 1] : null
  // Outbound exchange/replacement fulfillment after old items are received
  const activeExchangeReq =
    !open && lastRequest?.status === "received" && lastRequest.resolutionType === "exchange" ? lastRequest : null
  const isRepReq = Boolean(activeExchangeReq && /^replacement\s*:/i.test(activeExchangeReq.exchangePreference ?? ""))
  if (activeExchangeReq) {
    if (!activeExchangeReq.exchangeStatus && !activeExchangeReq.exchangeShippedAt) {
      options.push({
        value: "exchange_dispatch",
        label: isRepReq ? "Dispatch replacement" : "Dispatch exchange item",
        tone: "next",
        badge: "Next step",
      })
    } else if (activeExchangeReq.exchangeStatus === "dispatched" || (activeExchangeReq.exchangeShippedAt && !activeExchangeReq.exchangeDeliveredAt)) {
      options.push(
        {
          value: "exchange_deliver",
          label: isRepReq ? "Mark replacement delivered" : "Mark exchange delivered (Complete)",
          tone: "next",
          badge: "Next step",
        },
        { value: "exchange_undo_dispatch", label: "Undo dispatch", tone: "revert" }
      )
    } else if (activeExchangeReq.exchangeStatus === "delivered" || activeExchangeReq.exchangeDeliveredAt) {
      if (activeExchangeReq.exchangeMode !== "doorstep") {
        options.push({ value: "exchange_undo_deliver", label: "Undo delivered", tone: "revert" })
      }
    }
  }
  // Mis-click safety net: take back the last request step (pickup / approval / rejection). Received and refunds stay.
  const undoTarget = open?.status === "approved" ? open : !open && lastRequest?.status === "rejected" ? lastRequest : null
  const undoText = !undoTarget
    ? null
    : undoTarget.status === "rejected"
      ? { label: "Undo rejection", title: "Undo the rejection?", description: "The request goes back to “waiting for a decision”. The customer sees it as pending again." }
      : undoTarget.pickedUpAt
        ? { label: "Undo “Pickup successful”", title: "Undo the pickup?", description: "The return goes back to “pickup scheduled”." }
        : { label: "Undo approval", title: "Undo the approval?", description: "The request goes back to “waiting for a decision”. The pickup date and your note are cleared." }
  if (undoTarget && undoText) options.push({ value: "undo", label: undoText.label, tone: "revert" })
  // Allow reverting Delivered -> Shipped as long as no return/refund process has started on this order
  const canRevertDelivered = requests.length === 0 && returns.length === 0 && paymentStatus !== "refunded" && refundedAmount === 0
  if (canRevertDelivered) options.push({ value: "revert_shipped", label: "Revert to Shipped (undo Delivered)", tone: "revert" })

  // the chosen step can disappear after a refresh (e.g. it was just done): fall back to the current state
  const picked: Choice = options.some((o) => o.value === choice) ? choice : "current"

  return (
    <div className={styles.returnControlRoot}>
      <SelectField label="Order status" fieldSize="md" options={options} value={picked} onValueChange={(v) => setChoice(v as Choice)} />
      {stage && picked === "current" && <p className={styles.stageDetailText}>{stage.detail}</p>}
      {picked === "approve" && open && <DecideDialog request={open} approve orderCode={orderCode} customerName={customerName} phone={phone} />}
      {picked === "reject" && open && <DecideDialog request={open} approve={false} orderCode={orderCode} customerName={customerName} phone={phone} />}
      {picked === "picked_up" && open && <PickedUpButton requestId={open.id} />}
      {picked === "exchange_set_courier" && open && (
        <ExchangeFulfillmentControl request={open} mode="set_courier" orderCode={orderCode} customerName={customerName} phone={phone} stage={stage} />
      )}
      {picked === "exchange_dispatch" && activeExchangeReq && (
        <ExchangeFulfillmentControl request={activeExchangeReq} mode="dispatched" orderCode={orderCode} customerName={customerName} phone={phone} stage={stage} />
      )}
      {picked === "exchange_deliver" && activeExchangeReq && (
        <ExchangeFulfillmentControl request={activeExchangeReq} mode="delivered" orderCode={orderCode} customerName={customerName} phone={phone} stage={stage} />
      )}
      {picked === "exchange_undo_dispatch" && activeExchangeReq && (
        <ExchangeFulfillmentControl request={activeExchangeReq} mode="undo_dispatched" orderCode={orderCode} customerName={customerName} phone={phone} stage={stage} />
      )}
      {picked === "exchange_undo_deliver" && activeExchangeReq && (
        <ExchangeFulfillmentControl request={activeExchangeReq} mode="undo_delivered" orderCode={orderCode} customerName={customerName} phone={phone} stage={stage} />
      )}
      {picked === "create" && (
        <CreateReturnRequest
          orderId={orderId}
          orderCode={orderCode}
          items={items}
          returns={returns}
          discountAmount={discountAmount}
          paidAmount={paidAmount}
          refundedAmount={refundedAmount}
        />
      )}
      {picked === "undo" && undoTarget && undoText && <UndoStepButton requestId={undoTarget.id} title={undoText.title} description={undoText.description} />}
      {picked === "revert_shipped" && canRevertDelivered && (
        <div className={styles.revertShippedBlock}>
          <p className={styles.revertWarnBanner}>
            <RotateCcwIcon className={styles.revertWarnIcon} aria-hidden />
            <span>Moves this order one step back (Delivered → Shipped). Requires a reason in the next popup.</span>
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => setRevertOpen(true)}
            className={styles.revertSubmitBtn}
          >
            <RotateCcwIcon className={styles.iconMd} /> Revert to Shipped
          </Button>
          <RevertOrderStatusDialog
            open={revertOpen}
            onOpenChange={setRevertOpen}
            orderId={orderId}
            orderCode={orderCode}
            from="delivered"
            to="shipped"
          />
        </div>
      )}
      {picked === "received" && open && (
        <AdminReturnOrder
          orderId={orderId}
          orderCode={orderCode}
          status={status}
          paymentStatus={paymentStatus}
          refundedAmount={refundedAmount}
          discountAmount={discountAmount}
          paidAmount={paidAmount}
          items={items}
          returns={returns}
          prefill={{
            requestId: open.id,
            resolutionType: open.resolutionType,
            exchangeMode: open.exchangeMode,
            items: open.items.map((i) => ({
              productId: i.productId,
              ...(i.variantId ? { variantId: i.variantId } : {}),
              quantity: i.quantity,
            })),
          }}
          triggerLabel={isDoorstepApproved ? "Complete doorstep handover" : "Record the items that came back"}
        />
      )}
      {picked === "refund" && (
        <ul className={styles.unrefundedList}>
          {unrefunded.map((r) => {
            const latestRefundUpi =
              requests
                .map((req) => splitReturnDetails(req.details).refundUpiId)
                .filter(Boolean)
                .at(-1) ?? null
            return (
              <li key={r.id}>
                <RefundReturnButton
                  returnId={r.id}
                  value={returnValue(r, items, returns, discountAmount, refundedAmount, paidAmount)}
                  expectedRefunded={refundedAmount}
                  refundUpiId={latestRefundUpi}
                  paymentReference={paymentReference}
                  customerName={customerName}
                  orderCode={orderCode}
                />
              </li>
            )
          })}
        </ul>
      )}
      <p className={styles.stepHintText}>Pick the next step; its button asks for details and confirms before saving.</p>
    </div>
  )
}
