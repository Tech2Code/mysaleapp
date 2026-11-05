/**
 * ONE place for every length / size limit in the app.
 * The form inputs (maxLength), the zod schemas and the database checks all follow these numbers.
 * Changing a limit here changes it in every form and on the server. (Database CHECK constraints are
 * in supabase/migrations and must be updated together with a new migration.)
 */
export const LIMITS = {
  // people & places
  personName: { min: 2, max: 80 },
  city: { min: 2, max: 60 },
  region: { max: 60 },
  address: { min: 5, max: 300 },
  addressLabel: { min: 1, max: 20 },
  pincode: 6,
  /** Indian mobile number, digits only. */
  phone: 10,
  /** Number with country code, digits only (WhatsApp). */
  intlPhone: { min: 10, max: 15 },
  /** Display phone like "+91 98765 43210". */
  displayPhone: { max: 30 },
  orderLast4: 4,

  // account
  email: { max: 120 },
  password: { min: 6, max: 200 },
  newPassword: { min: 8 },
  url: { max: 300 },

  // free text
  note: { max: 500 },
  adminNote: { max: 1000 },
  paymentNote: { max: 300 },

  // shop settings
  shopName: { min: 2, max: 40 },
  tagline: { min: 3, max: 100 },
  shopDescription: { min: 10, max: 300 },
  keywords: { max: 400 },
  announcement: { max: 160 },
  orderPrefix: { min: 1, max: 5 },
  upiId: { max: 100 },
  payeeName: { min: 2, max: 60 },

  // catalogue
  productName: { min: 2, max: 120 },
  categoryName: { min: 2, max: 60 },
  slug: { min: 2, max: 80 },
  productDescription: { max: 5000 },
  shortDescription: { max: 240 },
  highlight: { max: 100 },
  highlightsText: { max: 900 },
  careInstructions: { max: 1500 },
  specLabel: { max: 40 },
  specValue: { max: 120 },
  feeLabel: { min: 2, max: 40 },
  feeReason: { max: 120 },
  seoTitle: { max: 70 },
  seoDescription: { max: 160 },
  categoryDescription: { max: 300 },

  // numbers
  money: { max: 1_000_000 },
  feeAmount: { max: 100_000 },
  deliveryFee: { max: 10_000 },
  stock: { max: 100_000 },
  sortOrder: { max: 999 },
  quantityPerItem: { max: 20 },

  // orders & payments
  orderCode: { max: 12 },
  utr: { min: 8, max: 35 },
  carrier: { min: 2, max: 60 },
  trackingNumber: { max: 60 },
} as const

export const PATTERNS = {
  /** Letters (any language), spaces, and . ' - */
  personName: /^[\p{L}\p{M}][\p{L}\p{M}\s.'-]*$/u,
  indianPhone: /^[6-9]\d{9}$/,
  pincode: /^[1-9]\d{5}$/,
  slug: /^[a-z0-9]+(-[a-z0-9]+)*$/,
  orderCode: /^[A-Z]{1,5}-[A-Z0-9]{6}$/,
  orderPrefix: /^[A-Z]{1,5}$/,
  upiId: /^[A-Za-z0-9._-]{2,64}@[A-Za-z0-9]{2,32}$/,
  utr: /^[A-Z0-9]{8,35}$/,
} as const
