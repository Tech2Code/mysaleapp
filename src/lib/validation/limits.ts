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
  highlightText: { min: 2, max: 60 },
  priceNote: { min: 2, max: 80 },
  legalName: { max: 100 },
  businessAddress: { max: 250 },
  /** GST rate in percent (India slabs go up to 28). */
  gstRate: { max: 28 },
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
  /** Courier consignment / AWB: India Post 13, Delhivery 11-14, DTDC 9-12, Blue Dart 11; 30 leaves room for aggregators. */
  trackingNumber: { min: 5, max: 30 },
  /** Largest payment / refund the admin can record (an order holds up to 30 lines). */
  paymentAmount: { max: 10_000_000 },
  /** How far ahead an expected-delivery / pickup date may be (days). Pickup is also enforced in SQL (decide_return_request). */
  expectedDeliveryDays: { max: 90 },
  pickupDays: { max: 90 },
  /** Dropdown reason for a cancel / return (the picked label). */
  reason: { min: 2, max: 80 },
  /** Extra words next to a cancel reason. */
  cancelDetail: { max: 200 },
  /** Return details, decision note, return reason (admin and customer). */
  returnDetail: { max: 300 },
  /** Quantity typed for one product in a return (orders cap a line at quantityPerItem). */
  returnQuantity: { min: 1, max: 20 },
  gstin: 15,
  /** Hours before an unpaid order is cancelled (0 = never); DB check in migration 0011. */
  unpaidExpiryHours: { max: 720 },
  /** Days a customer may request a return after delivery (0 = off); DB check in migration 0012. */
  returnWindowDays: { max: 90 },
  /** Search boxes: storefront product search, admin order search (letters, digits, space, hyphen). */
  search: { max: 80 },
  orderSearch: { max: 40 },
  orderLines: { max: 30 },
  returnLines: { max: 50 },
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
  /** Courier AWB after upper-casing: letters, digits, - / _ (starts with a letter or digit, no spaces). */
  trackingNumber: /^[A-Z0-9][A-Z0-9/_-]*$/,
  isoDate: /^\d{4}-\d{2}-\d{2}$/,
} as const
