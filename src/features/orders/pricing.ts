import type { Product, ShippingClass } from "@/features/products/types"
import type { StoreSettings } from "@/features/settings/types"
import type { OrderFee } from "./types"

export type ChargeLine = {
  price: number
  quantity: number
  name?: string
  weightGrams?: number
  shippingClass?: ShippingClass
}

export type Charges = {
  /** Items total (price × quantity). */
  subtotal: number
  /** Standard delivery charge actually payable (0 when waived). */
  shippingFee: number
  /** Standard delivery charge before any free-delivery waiver, for the strike-through. */
  shippingFeeOriginal: number
  /** Smart order-level surcharges (special handling tier + heavy parcel weight slab). */
  extraFees: OrderFee[]
  total: number
  /** ₹ still needed to unlock free standard delivery; 0 when already free or not offered. */
  amountToFreeDelivery: number
}

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * Deterministic human-readable weight formatter shared with PostgreSQL `create_order`:
 * `350` → `"350 g"`, `1000` → `"1 kg"`, `1400` → `"1.4 kg"`, `1250` → `"1.25 kg"`.
 */
export function formatWeightGrams(grams: number): string {
  const g = Math.max(0, Math.trunc(grams))
  if (g >= 1000) {
    return `${Math.round(g / 10) / 100} kg`
  }
  return `${g} g`
}

export const HANDLING_LABELS = {
  oversized: {
    label: "Large / bulky item handling",
    reason: "Special courier handling & protective packing for large items",
  },
  fragile: {
    label: "Fragile item packaging",
    reason: "Protective bubble & box cushioning for fragile items",
  },
  heavyWeight: "Heavy parcel surcharge",
} as const

function uniqueSortedNames(lines: readonly ChargeLine[], shippingClass: ShippingClass): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const line of lines) {
    if (line.shippingClass !== shippingClass || !line.name) continue
    const trimmed = line.name.trim()
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    out.push(trimmed)
  }
  return out.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()) || a.localeCompare(b))
}

/**
 * Explains any special handling or single-unit heavy-parcel surcharge applicable to ONE product on its detail page.
 * Returns an empty array for regular items or when the corresponding store fee is ₹0.
 */
export function describeProductSurcharges(
  product: Pick<Product, "weightGrams" | "shippingClass">,
  settings: StoreSettings
): { label: string; amount: number; reason: string }[] {
  const notes: { label: string; amount: number; reason: string }[] = []
  if (product.shippingClass === "oversized" && round2(settings.oversizedFee) > 0) {
    notes.push({
      label: HANDLING_LABELS.oversized.label,
      amount: round2(settings.oversizedFee),
      reason: `${HANDLING_LABELS.oversized.reason} (charged once per order, never multiplied by quantity).`,
    })
  } else if (product.shippingClass === "fragile" && round2(settings.fragileFee) > 0) {
    notes.push({
      label: HANDLING_LABELS.fragile.label,
      amount: round2(settings.fragileFee),
      reason: `${HANDLING_LABELS.fragile.reason} (charged once per order, never multiplied by quantity).`,
    })
  }

  const unitWeight = Math.max(0, Math.trunc(product.weightGrams))
  const freeWeight = Math.max(0, Math.trunc(settings.freeWeightGrams))
  const ratePerKg = round2(settings.extraWeightFeePerKg)
  if (ratePerKg > 0 && unitWeight > freeWeight) {
    const extraKg = Math.ceil((unitWeight - freeWeight) / 1000)
    notes.push({
      label: HANDLING_LABELS.heavyWeight,
      amount: round2(extraKg * ratePerKg),
      reason:
        freeWeight > 0
          ? `Parcel weight ${formatWeightGrams(unitWeight)} exceeds the ${formatWeightGrams(freeWeight)} base allowance (${formatWeightGrams(1000)} slabs @ ₹${ratePerKg}/kg across your total cart weight).`
          : `Parcel weight ${formatWeightGrams(unitWeight)} is billed by total cart weight at ₹${ratePerKg}/kg.`,
    })
  }
  return notes
}

/**
 * Intelligent e-commerce charge engine (Shopify Shipping Profiles / Amazon Heavy & Bulky / Shiprocket Weight Slab style).
 * Used for the live cart & checkout preview; PostgreSQL `public.create_order` runs the exact same formula on submit.
 *
 * Rules:
 *  1. Base delivery: `settings.deliveryFee`, waived when `subtotal >= settings.freeDeliveryAbove` (> 0).
 *  2. Special handling tier (ONCE per order, highest applicable tier wins — never compounded per item or quantity):
 *     - Oversized items in cart vs Fragile items in cart → whichever applicable tier has the higher configured fee (> 0).
 *  3. Heavy parcel courier slab (across TOTAL cart weight = sum(weightGrams × quantity)):
 *     - When `totalWeightGrams > settings.freeWeightGrams` and `settings.extraWeightFeePerKg > 0`,
 *       charges `ceil((totalWeightGrams - freeWeightGrams) / 1000) × extraWeightFeePerKg`.
 */
export function calculateCharges(lines: readonly ChargeLine[], settings: StoreSettings): Charges {
  const activeLines = lines.filter((l) => l.quantity > 0)
  const subtotal = round2(activeLines.reduce((sum, l) => sum + l.price * l.quantity, 0))
  const extraFees: OrderFee[] = []

  if (activeLines.length > 0) {
    const hasOversized = activeLines.some((l) => l.shippingClass === "oversized")
    const hasFragile = activeLines.some((l) => l.shippingClass === "fragile")
    const oversizedAmt = hasOversized ? round2(settings.oversizedFee) : 0
    const fragileAmt = hasFragile ? round2(settings.fragileFee) : 0

    if (oversizedAmt > 0 && oversizedAmt >= fragileAmt) {
      const names = uniqueSortedNames(activeLines, "oversized")
      extraFees.push({
        label: HANDLING_LABELS.oversized.label,
        amount: oversizedAmt,
        ...(names.length > 0 ? { productName: names.join(", ") } : {}),
        reason: HANDLING_LABELS.oversized.reason,
      })
    } else if (fragileAmt > 0) {
      const names = uniqueSortedNames(activeLines, "fragile")
      extraFees.push({
        label: HANDLING_LABELS.fragile.label,
        amount: fragileAmt,
        ...(names.length > 0 ? { productName: names.join(", ") } : {}),
        reason: HANDLING_LABELS.fragile.reason,
      })
    }

    const totalWeightGrams = activeLines.reduce(
      (sum, l) => sum + Math.max(0, Math.trunc(l.weightGrams ?? 0)) * l.quantity,
      0
    )
    const freeWeightGrams = Math.max(0, Math.trunc(settings.freeWeightGrams))
    const ratePerKg = round2(settings.extraWeightFeePerKg)

    if (ratePerKg > 0 && totalWeightGrams > freeWeightGrams) {
      const extraKg = Math.ceil((totalWeightGrams - freeWeightGrams) / 1000)
      const weightAmt = round2(extraKg * ratePerKg)
      if (weightAmt > 0) {
        extraFees.push({
          label: HANDLING_LABELS.heavyWeight,
          amount: weightAmt,
          reason:
            freeWeightGrams > 0
              ? `Total parcel weight ${formatWeightGrams(totalWeightGrams)} (${extraKg} kg above ${formatWeightGrams(freeWeightGrams)} included)`
              : `Total parcel weight ${formatWeightGrams(totalWeightGrams)} (${extraKg} kg courier slab)`,
        })
      }
    }
  }

  const hasItems = activeLines.length > 0
  const freeOffered = settings.freeDeliveryAbove > 0
  const isFree = freeOffered && subtotal >= settings.freeDeliveryAbove
  const shippingFeeOriginal = hasItems ? round2(settings.deliveryFee) : 0
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
