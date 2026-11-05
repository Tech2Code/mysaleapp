import { z } from "zod"
import { v } from "@/lib/validation"

/** Shared by the checkout form (client) and the placeOrder action (server). Rules live in lib/validation. */
export const checkoutSchema = z.object({
  name: v.personName("name"),
  phone: v.phoneIN(),
  address: v.address(),
  city: v.city(),
  pincode: v.pincode(),
  note: v.note().optional(),
})

export type CheckoutInput = z.infer<typeof checkoutSchema>

export const cartLineSchema = z.object({
  productId: z.uuid(),
  quantity: z.number().int().min(1).max(20),
})

export const placeOrderSchema = z.object({
  customer: checkoutSchema,
  items: z.array(cartLineSchema).min(1, "Your cart is empty").max(30),
  /** Signed-in customers: also save this delivery address to their address book. */
  saveAddress: z.boolean().optional(),
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

const blankToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v)

/** Shipping details the admin adds when marking an order as shipped. Shared by form and server. */
export const shippingSchema = z.object({
  carrier: z.string().trim().min(2, "Enter the courier name").max(60, "Too long"),
  trackingNumber: z.preprocess(blankToUndefined, z.string().trim().max(60, "Too long").optional()),
  trackingUrl: z.preprocess(
    blankToUndefined,
    z
      .string()
      .trim()
      .max(500, "Link is too long")
      .refine((u) => {
        try {
          const { protocol } = new URL(u)
          return protocol === "http:" || protocol === "https:"
        } catch {
          return false
        }
      }, "Enter a full link starting with https://")
      .optional()
  ),
  expectedDelivery: z.preprocess(
    blankToUndefined,
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid date")
      .refine((d) => !Number.isNaN(Date.parse(d)), "Pick a valid date")
      .optional()
  ),
})

export type ShippingInput = z.output<typeof shippingSchema>

export const trackOrderSchema = z.object({
  code: v.orderCode(),
  phoneLast4: v.orderLast4(),
})

/** The UPI reference (UTR) a customer enters after paying. Normally 12 digits. */
export const paymentReferenceSchema = v.utr()

export const cancelOrderSchema = z.object({
  code: trackOrderSchema.shape.code,
  /** Needed for guests; signed-in customers are recognised by their account. */
  phoneLast4: trackOrderSchema.shape.phoneLast4.optional(),
  reason: z.string().trim().max(300, "Keep the reason under 300 characters").optional(),
})

export const requestReturnSchema = z.object({
  code: trackOrderSchema.shape.code,
  /** Needed for guests; signed-in customers are recognised by their account. */
  phoneLast4: trackOrderSchema.shape.phoneLast4.optional(),
  items: z
    .array(z.object({ productId: z.uuid(), quantity: z.number().int().min(1).max(999) }))
    .min(1, "Choose at least one item to return")
    .max(50),
  reason: z.string().trim().min(2, "Choose a reason").max(80),
  details: z.string().trim().max(300, "Keep it under 300 characters").optional(),
})

export const withdrawReturnSchema = z.object({
  code: trackOrderSchema.shape.code,
  phoneLast4: trackOrderSchema.shape.phoneLast4.optional(),
  requestId: z.uuid(),
})

export const submitPaymentSchema = z.object({
  code: trackOrderSchema.shape.code,
  phoneLast4: trackOrderSchema.shape.phoneLast4,
  reference: paymentReferenceSchema,
})

export const updateDeliverySchema = z.object({
  code: trackOrderSchema.shape.code,
  /** Needed for guests; signed-in owners are recognised by their session. */
  phoneLast4: z.string().trim().regex(/^\d{4}$/).optional(),
  customer: checkoutSchema,
})
