import { z } from "zod"
import { LIMITS, v } from "@/lib/validation"

/** Shared by the address form (client) and the save action (server). */
export const addressSchema = z.object({
  label: z
    .string()
    .trim()
    .min(LIMITS.addressLabel.min, "Give it a name, like Home")
    .max(LIMITS.addressLabel.max, `Keep it under ${LIMITS.addressLabel.max} characters`),
  fullName: v.personName("name"),
  phone: v.phoneIN(),
  address: v.address(),
  city: v.city(),
  pincode: v.pincode(),
  isDefault: z.boolean(),
})

export type AddressInput = z.input<typeof addressSchema>
export type AddressValues = z.output<typeof addressSchema>
