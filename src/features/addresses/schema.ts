import { z } from "zod"
import { joinCityState } from "@/features/location/states"
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
  state: v.state(),
  pincode: v.pincode(),
  isDefault: z.boolean(),
}).refine((a) => joinCityState(a.city, a.state).length <= LIMITS.city.max, {
  // the database keeps "City, State" in one column
  path: ["city"],
  error: "City name is too long to save with the state",
})

export type AddressInput = z.input<typeof addressSchema>
export type AddressValues = z.output<typeof addressSchema>
