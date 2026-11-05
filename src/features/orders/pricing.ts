import type { ProductFee } from "@/features/products/types"
import type { StoreSettings } from "@/features/settings/types"
import type { OrderFee } from "./types"

export type ChargeLine = { price: number; quantity: number; name?: string; fees?: readonly ProductFee[] }

export type Charges = {
  /** Items total (price × quantity). */
  subtotal: number
  /** Delivery charge actually payable (0 when waived). */
  shippingFee: number
  /** Delivery charge before any free-delivery waiver, for the strike-through. */
  shippingFeeOriginal: number
  /** Extra charges (handling etc.), one entry per charge per product. */
  extraFees: OrderFee[]
  total: number
  /** ₹ still needed to unlock free delivery; 0 when already free or not offered. */
  amountToFreeDelivery: number
}

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * What the customer will pay. Used for the cart and checkout preview.
 * The database function `create_order` performs the same calculation and is
 * the source of truth when the order is actually placed.
 *
 * Product charges (handling etc.) are added ONCE per product, never multiplied by the quantity.
 */
export function calculateCharges(lines: readonly ChargeLine[], settings: StoreSettings): Charges {
  const subtotal = round2(lines.reduce((sum, l) => sum + l.price * l.quantity, 0))

  const extraFees: OrderFee[] = lines
    .flatMap((line) =>
      (line.fees ?? [])
        .filter((fee) => fee.amount > 0)
        .map((fee) => ({
          label: fee.label,
          amount: round2(fee.amount),
          ...(line.name ? { productName: line.name } : {}),
          ...(fee.reason ? { reason: fee.reason } : {}),
        }))
    )
    .sort((a, b) => (a.productName ?? "").localeCompare(b.productName ?? "") || a.label.localeCompare(b.label))

  const hasItems = lines.length > 0
  const freeOffered = settings.freeDeliveryAbove > 0
  const isFree = freeOffered && subtotal >= settings.freeDeliveryAbove
  const shippingFeeOriginal = hasItems ? settings.deliveryFee : 0
  const shippingFee = isFree ? 0 : shippingFeeOriginal

  return {
    subtotal,
    shippingFee,
    shippingFeeOriginal,
    extraFees,
    total: round2(subtotal + shippingFee + extraFees.reduce((s, f) => s + f.amount, 0)),
    amountToFreeDelivery: hasItems && freeOffered && !isFree ? round2(settings.freeDeliveryAbove - subtotal) : 0,
  }
}
