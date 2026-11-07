import type { Address } from "@/features/addresses/types"
import type { Profile } from "./schema"

/** Placeholder data for loading states (see components/shared/skeletonize.tsx). */

export const placeholderProfile = (): Profile => ({ fullName: "Customer name", phone: "9876543210", avatarUrl: null, email: "customer@example.com" })

export const placeholderAddresses = (n = 2): Address[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `ph-address-${i}`,
    label: i === 0 ? "Home" : "Work",
    fullName: "Customer name",
    phone: "9876543210",
    address: "12, Sample Street, Sample Nagar",
    city: "Mumbai, Maharashtra",
    pincode: "400001",
    isDefault: i === 0,
  }))
