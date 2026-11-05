import { siteConfig } from "@/config/site"
import { formatPrice } from "@/lib/format"
import { STATUS_META, type OrderItem, type OrderStatus } from "./types"

/** wa.me deep link that opens WhatsApp (app on mobile, web on desktop). */
export function whatsappLink(phoneWithCountryCode: string, text?: string): string {
  const digits = phoneWithCountryCode.replace(/\D/g, "")
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`
}

export function shopWhatsappLink(text?: string): string {
  return whatsappLink(siteConfig.whatsappNumber, text)
}

/** Message the CUSTOMER sends to the shop right after placing an order. */
export function buildOrderMessage(input: {
  orderCode: string
  customer: { name: string; phone: string; address: string; city: string; pincode: string; note?: string }
  items: Pick<OrderItem, "name" | "price" | "quantity">[]
  subtotal: number
}): string {
  const lines = input.items.map(
    (i, idx) => `${idx + 1}. ${i.name} × ${i.quantity} — ${formatPrice(i.price * i.quantity)}`
  )
  const c = input.customer
  return [
    `Hi ${siteConfig.name}! 👋 I'd like to place an order.`,
    ``,
    `🧾 *Order ${input.orderCode}*`,
    ...lines,
    ``,
    `*Total: ${formatPrice(input.subtotal)}*`,
    ``,
    `📦 *Deliver to*`,
    `${c.name} (${c.phone})`,
    `${c.address}, ${c.city} - ${c.pincode}`,
    ...(c.note ? [``, `📝 ${c.note}`] : []),
    ``,
    `Track: ${siteConfig.url}/track?code=${input.orderCode}`,
  ].join("\n")
}

/** Message the ADMIN sends to the customer when updating an order's status. */
export function buildStatusUpdateMessage(input: {
  orderCode: string
  customerName: string
  status: OrderStatus
}): string {
  const meta = STATUS_META[input.status]
  return [
    `Hi ${input.customerName.split(" ")[0]}, this is ${siteConfig.name} 🙏`,
    ``,
    `Your order *${input.orderCode}* is now *${meta.label}*.`,
    meta.description + ".",
    ``,
    `Track anytime: ${siteConfig.url}/track?code=${input.orderCode}`,
  ].join("\n")
}
