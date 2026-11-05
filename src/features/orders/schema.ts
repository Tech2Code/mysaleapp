import { z } from "zod"
import { normalizeIndianPhone } from "@/lib/format"

/** Shared by the checkout form (client) and the placeOrder action (server). */
export const checkoutSchema = z.object({
  name: z.string().trim().min(2, "Please enter your full name").max(80),
  phone: z
    .string()
    .trim()
    .refine((v) => normalizeIndianPhone(v) !== null, "Enter a valid 10-digit mobile number"),
  address: z.string().trim().min(5, "Please enter your full address").max(300),
  city: z.string().trim().min(2, "Please enter your city").max(60),
  pincode: z.string().trim().regex(/^[1-9]\d{5}$/, "Enter a valid 6-digit pincode"),
  note: z.string().trim().max(500, "Keep the note under 500 characters").optional(),
})

export type CheckoutInput = z.infer<typeof checkoutSchema>

export const cartLineSchema = z.object({
  productId: z.uuid(),
  quantity: z.number().int().min(1).max(20),
})

export const placeOrderSchema = z.object({
  customer: checkoutSchema,
  items: z.array(cartLineSchema).min(1, "Your cart is empty").max(30),
  saveToProfile: z.boolean().optional(),
})

export type PlaceOrderInput = z.infer<typeof placeOrderSchema>

export const trackOrderSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{1,5}-[A-Z0-9]{6}$/, "Enter the order code, e.g. KK-7F3K9Q"),
  phoneLast4: z.string().trim().regex(/^\d{4}$/, "Enter the last 4 digits of your phone"),
})
