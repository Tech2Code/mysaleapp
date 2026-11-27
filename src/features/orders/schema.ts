import { z } from "zod"
import { joinCityState } from "@/features/location/states"
import { LIMITS, addDays, todayIST, v } from "@/lib/validation"
import { OTHER_DETAIL_MESSAGE, otherNeedsDetail } from "./reasons"

/** Shared by the checkout form (client) and the placeOrder action (server). Rules live in lib/validation. */
export const checkoutSchema = z.object({
  name: v.personName("name"),
  phone: v.phoneIN(),
  address: v.address(),
  city: v.city(),
  state: v.state(),
  pincode: v.pincode(),
  note: v.note().optional(),
}).refine((c) => joinCityState(c.city, c.state).length <= LIMITS.city.max, {
  // the database keeps "City, State" in one column
  path: ["city"],
  error: "City name is too long to save with the state",
})

export type CheckoutInput = z.infer<typeof checkoutSchema>

export const cartLineSchema = z.object({
  productId: z.uuid(),
  variantId: z.string().trim().min(1).max(64).optional(),
  quantity: v.quantity(),
})

/** The UPI reference (UTR) a customer enters after paying. Normally 12 digits. */
export const paymentReferenceSchema = v.utr()

/** Gateway payment/refund reference ID (e.g. pay_..., rfnd_...) or 12-digit UTR. */
export const gatewayReferenceSchema = v.gatewayRef()

export const placeOrderSchema = z.object({
  customer: checkoutSchema,
  items: z.array(cartLineSchema).min(1, "Your cart is empty").max(LIMITS.orderLines.max),
  /** UPI UTR / reference number entered by the customer during checkout payment step. */
  paymentReference: paymentReferenceSchema,
  /** Optional promo code applied at checkout. */
  promoCode: z
    .preprocess(
      (x) => (typeof x === "string" && x.trim() === "" ? undefined : x),
      z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,24}$/, "Invalid promo code").optional()
    ),
  /** Client-rendered total used by the DB to catch mid-checkout product price / fee changes. */
  expectedTotal: v.optionalMoney(LIMITS.paymentAmount.max).optional(),
  /** Signed-in customers: also save this delivery address to their address book. */
  saveAddress: z.boolean().optional(),
})

export const createGatewayOrderSchema = placeOrderSchema.omit({ paymentReference: true })

export const verifyGatewayPaymentSchema = z.object({
  code: v.orderCode(),
  phoneLast4: v.orderLast4(),
  gatewayOrderId: z.string().trim().min(4).max(80),
  paymentId: gatewayReferenceSchema,
  signature: z.string().trim().min(16).max(256),
})

export const validatePromoSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(1, "Enter a promo code")
    .regex(/^[A-Z0-9_-]{3,24}$/, "Enter a valid promo code"),
  subtotal: z.number().nonnegative(),
})

export type PlaceOrderInput = z.infer<typeof placeOrderSchema>

/** Couriers offered as suggestions in the admin form (any other name can still be typed). */
export const COURIER_SUGGESTIONS = [
  "India Post",
  "Delhivery",
  "DTDC",
  "Blue Dart",
  "Ecom Express",
  "Xpressbees",
  "Shadowfax",
  "Professional Couriers",
  "Self delivery",
]

const blankToUndefined = (x: unknown) => (typeof x === "string" && x.trim() === "" ? undefined : x)

/** Shipping details the admin adds when marking an order as shipped. Shared by form and server. */
export const shippingSchema = z.object({
  carrier: z.string().trim().min(LIMITS.carrier.min, "Enter the courier name").max(LIMITS.carrier.max, "Too long"),
  trackingNumber: z.preprocess(blankToUndefined, v.trackingNumber().optional()),
  trackingUrl: z.preprocess(blankToUndefined, v.httpsUrl("tracking link").optional()),
  /** Real day, at most LIMITS.expectedDeliveryDays ahead. "Not in the past" is checked on change only: see expectedDeliveryProblem. */
  expectedDelivery: z.preprocess(
    blankToUndefined,
    v
      .isoDate()
      .refine((d) => d <= addDays(todayIST(), LIMITS.expectedDeliveryDays.max), `Within the next ${LIMITS.expectedDeliveryDays.max} days`)
      .optional()
  ),
})

/**
 * A date the admin CHANGED must not be in the past. An unchanged date is left alone, otherwise an order that is
 * running late could never be marked delivered. Returns the message, or null when fine.
 */
export function expectedDeliveryProblem(next: string | null | undefined, previous: string | null | undefined, today = todayIST()): string | null {
  if (!next || next === previous) return null
  return next < today ? "Pick today or a later date" : null
}

export type ShippingInput = z.output<typeof shippingSchema>

export const trackOrderSchema = z.object({
  code: v.orderCode(),
  phoneLast4: v.orderLast4(),
})

export const cancelOrderSchema = z.object({
  code: trackOrderSchema.shape.code,
  /** Needed for guests; signed-in customers are recognised by their account. */
  phoneLast4: trackOrderSchema.shape.phoneLast4.optional(),
  /**
   * The FULL mobile number. Cancelling is destructive, so a guest must prove the whole number (not just the last 4
   * digits: 10^4 guesses are too few, migration 0022). Signed-in owners can leave it out.
   */
  phone: v.phoneIN().optional(),
  /** The reason picked from the list. */
  reason: v.reason(),
  /** Extra words; required when the reason is "Other". */
  detail: v.note(LIMITS.cancelDetail.max).optional(),
  /** Optional customer UPI ID (VPA) for receiving the refund faster. */
  refundUpiId: z.preprocess(blankToUndefined, v.upiId().optional()),
}).refine((v) => !otherNeedsDetail(v.reason, v.detail), { path: ["detail"], error: OTHER_DETAIL_MESSAGE })

export const requestReturnSchema = z
  .object({
    code: trackOrderSchema.shape.code,
    /** Needed for guests; signed-in customers are recognised by their account. */
    phoneLast4: trackOrderSchema.shape.phoneLast4.optional(),
    /** Full mobile number required for guests (migration 0050); signed-in owners are recognised by their session. */
    phone: v.phoneIN().optional(),
    items: z
      .array(z.object({ productId: z.uuid(), quantity: v.quantity(LIMITS.returnQuantity.max) }))
      .min(1, "Choose at least one item to return")
      .max(LIMITS.returnLines.max)
      .refine((items) => new Set(items.map((i) => i.productId)).size === items.length, "Each item can only be listed once"),
    reason: v.reason(),
    details: v.note(LIMITS.returnDetail.max).optional(),
    resolutionType: z.enum(["refund", "exchange"]).default("refund"),
    exchangePreference: v.note(200).optional(),
    pickupAddress: v.note(240).optional(),
    /** Optional customer UPI ID (VPA) for receiving the return refund faster. */
    refundUpiId: z.preprocess(blankToUndefined, v.upiId().optional()),
  })
  .refine((v) => !otherNeedsDetail(v.reason, v.details), {
    path: ["details"],
    error: OTHER_DETAIL_MESSAGE,
  })
  .refine(
    (v) =>
      v.resolutionType !== "exchange" ||
      Boolean(v.exchangePreference && v.exchangePreference.replace(/^(Replacement|Exchange)\s*:\s*/i, "").trim().length >= 2),
    {
      path: ["exchangePreference"],
      error: "Please enter what you would like in exchange (size, colour, or replacement details).",
    }
  )

export const withdrawReturnSchema = z.object({
  code: trackOrderSchema.shape.code,
  phoneLast4: trackOrderSchema.shape.phoneLast4.optional(),
  /** Full mobile number required for guests (migration 0046); signed-in owners are recognised by their session. */
  phone: v.phoneIN().optional(),
  requestId: z.uuid(),
})

export const submitPaymentSchema = z.object({
  code: trackOrderSchema.shape.code,
  phoneLast4: trackOrderSchema.shape.phoneLast4,
  reference: paymentReferenceSchema,
})

export const createGatewayRetrySchema = trackOrderSchema

export const updateDeliverySchema = z.object({
  code: trackOrderSchema.shape.code,
  /** Needed for guests; signed-in owners are recognised by their session. */
  phoneLast4: v.orderLast4().optional(),
  /** The order's CURRENT full mobile number; required from guests (migration 0022), not from signed-in owners. */
  phone: v.phoneIN().optional(),
  customer: checkoutSchema,
})
