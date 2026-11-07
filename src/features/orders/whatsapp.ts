import { siteConfig } from "@/config/site"
import type { StoreSettings } from "@/features/settings/types"
import { formatDate, formatPrice } from "@/lib/format"
import type { ReturnStage } from "./returns"
import { STATUS_META,type OrderItem, type OrderPricing, type OrderStatus, type ShippingDetails } from "./types"

/** The bits of the owner's settings these messages need. Pass the whole StoreSettings object. */
type Shop = Pick<StoreSettings, "shopName" | "whatsappNumber">

/** wa.me deep link that opens WhatsApp (app on mobile, web on desktop). */
export function whatsappLink(phoneWithCountryCode: string, text?: string): string {
  const digits = phoneWithCountryCode.replace(/\D/g, "")
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`
}

/** Link that opens a chat with the shop's own WhatsApp number (from Admin → Settings). */
export function shopWhatsappLink(shop: Pick<StoreSettings, "whatsappNumber">, text?: string): string {
  return whatsappLink(shop.whatsappNumber, text)
}

/** Message the CUSTOMER sends to the shop right after placing an order. */
export function buildOrderMessage(
  shop: Shop,
  input: {
    orderCode: string
    customer: { name: string; phone: string; address: string; city: string; pincode: string; note?: string }
    items: Pick<OrderItem, "name" | "price" | "quantity">[]
    pricing: OrderPricing
  }
): string {
  const lines = input.items.map(
    (i, idx) => `${idx + 1}. ${i.name} × ${i.quantity} — ${formatPrice(i.price * i.quantity)}`
  )
  const p = input.pricing
  const c = input.customer

  const charges = [
    `Items: ${formatPrice(p.subtotal)}`,
    ...p.extraFees.map((f) => `${f.label}${f.productName ? ` (${f.productName})` : ""}: ${formatPrice(f.amount)}`),
    p.shippingFee > 0 ? `Delivery: ${formatPrice(p.shippingFee)}` : `Delivery: FREE`,
  ]

  return [
    `Hi ${shop.shopName}! 👋 I've placed an order and will pay by UPI.`,
    ``,
    `🧾 *Order ${input.orderCode}*`,
    ...lines,
    ``,
    ...charges,
    `*Total to pay: ${formatPrice(p.total)}*`,
    ``,
    `📦 *Deliver to*`,
    `${c.name} (${c.phone})`,
    `${c.address}, ${c.city} - ${c.pincode}`,
    ...(c.note ? [``, `📝 ${c.note}`] : []),
    ``,
    `Track: ${siteConfig.url}/track?code=${input.orderCode}`,
  ].join("\n")
}

/** Message the ADMIN sends after verifying (or rejecting) a payment. */
export function buildPaymentMessage(
  shop: Shop,
  input: {
    orderCode: string
    customerName: string
    result: "paid" | "failed"
    amount?: number | null
    reason?: string | null
  }
): string {
  const first = input.customerName.split(" ")[0]
  if (input.result === "paid") {
    return [
      `Hi ${first}, this is ${shop.shopName} 🙏`,
      ``,
      `✅ We received your payment${input.amount ? ` of ${formatPrice(input.amount)}` : ""} for order *${input.orderCode}*.`,
      `Your order is confirmed and we're getting it ready.`,
      ``,
      `Track anytime: ${siteConfig.url}/track?code=${input.orderCode}`,
    ].join("\n")
  }
  return [
    `Hi ${first}, this is ${shop.shopName} 🙏`,
    ``,
    `We couldn't verify the payment for order *${input.orderCode}*.`,
    ...(input.reason ? [`Reason: ${input.reason}`] : []),
    `Please check the UTR / reference number and submit it again here:`,
    `${siteConfig.url}/track?code=${input.orderCode}`,
  ].join("\n")
}

/** Message the ADMIN sends to the customer when updating an order's status. */
export function buildStatusUpdateMessage(
  shop: Shop,
  input: {
    orderCode: string
    customerName: string
    status: OrderStatus
    shipping?: ShippingDetails | null
    /** A delivered order with a return in progress is described by its return stage, not by "Delivered". */
    returnStage?: ReturnStage | null
  }
): string {
  if (input.returnStage?.badge && input.status === "delivered") {
    return buildReturnStageMessage(shop, { orderCode: input.orderCode, customerName: input.customerName, stage: input.returnStage })
  }
  const meta = STATUS_META[input.status]
  const s = input.shipping
  const shippingLines =
    input.status === "shipped" && s?.carrier
      ? [
          ``,
          `🚚 *Shipping details*`,
          `Courier: ${s.carrier}`,
          ...(s.trackingNumber ? [`Tracking no.: ${s.trackingNumber}`] : []),
          ...(s.trackingUrl ? [`Track shipment: ${s.trackingUrl}`] : []),
          ...(s.expectedDelivery ? [`Expected delivery: ${formatDate(`${s.expectedDelivery}T00:00:00`)}`] : []),
        ]
      : []

  return [
    `Hi ${input.customerName.split(" ")[0]}, this is ${shop.shopName} 🙏`,
    ``,
    `Your order *${input.orderCode}* is now *${meta.label}*.`,
    meta.description + ".",
    ...shippingLines,
    ``,
    `Track anytime: ${siteConfig.url}/track?code=${input.orderCode}`,
  ].join("\n")
}

/** Message the ADMIN sends about where a return is (customer wording, no amounts: same words as the order page). */
export function buildReturnStageMessage(shop: Shop, input: { orderCode: string; customerName: string; stage: ReturnStage }): string {
  return [
    `Hi ${input.customerName.split(" ")[0]}, this is ${shop.shopName} 🙏`,
    ``,
    `Update on the return for your order *${input.orderCode}*:`,
    `*${input.stage.customerLabel}*`,
    input.stage.customerDetail + ".",
    ``,
    `Track anytime: ${siteConfig.url}/track?code=${input.orderCode}`,
  ].join("\n")
}

/** Message the ADMIN sends to the customer about their return request. */
export function buildReturnDecisionMessage(
  shop: Shop,
  input: { orderCode: string; customerName: string; approved: boolean; note?: string | null }
): string {
  return [
    `Hi ${input.customerName}! 👋`,
    `Update on your return request for order *${input.orderCode}* from ${shop.shopName}:`,
    "",
    input.approved ? "✅ *Approved.*" : "❌ *We couldn't approve this return.*",
    ...(input.note ? [input.approved ? `How to send it back: ${input.note}` : `Reason: ${input.note}`] : []),
    ...(input.approved ? ["Once the items reach us and are checked, we'll process your refund."] : []),
    "",
    "Reply here if you have any questions.",
  ].join("\n")
}
