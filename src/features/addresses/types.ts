export const ADDRESS_LABELS = ["Home", "Work", "Other"] as const
export const MAX_ADDRESSES = 10

export type Address = {
  id: string
  label: string
  fullName: string
  phone: string
  address: string
  city: string
  pincode: string
  isDefault: boolean
}

export type AddressRow = {
  id: string
  label: string
  full_name: string
  phone: string
  address: string
  city: string
  pincode: string
  is_default: boolean
}

export function mapAddress(row: AddressRow): Address {
  return {
    id: row.id,
    label: row.label,
    fullName: row.full_name,
    phone: row.phone,
    address: row.address,
    city: row.city,
    pincode: row.pincode,
    isDefault: row.is_default,
  }
}
