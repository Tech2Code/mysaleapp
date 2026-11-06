/**
 * Everything the shop owner can change from Admin → Settings, without touching code.
 * Defaults live in ./defaults.ts and are used until a value is saved.
 */
export type StoreSettings = {
  // ---- Shop profile & SEO ----
  shopName: string
  tagline: string
  description: string
  /** Search keywords for Google (meta keywords + structured data). */
  keywords: string[]
  /** Optional one-line banner shown at the top of every store page. */
  announcement: string | null
  /** First perk on every product page, e.g. "Handmade by skilled artisans". */
  highlightLine: string
  /** Small badge above the home page headline, e.g. "Handmade in India · Made to be gifted". */
  heroBadge: string
  /** Small line under the price on product pages. null = none (or "Inclusive of all taxes" once GST is on). */
  priceNote: string | null

  // ---- Tax & invoices ----
  /** Turn on after getting a GSTIN: invoices become Tax Invoices and prices are shown as tax-inclusive. */
  gstRegistered: boolean
  /** 15-character GSTIN. Required when gstRegistered. */
  gstin: string | null
  /** GST percent that is already INCLUDED in every price (e.g. 12). Used on the Tax Invoice. */
  gstRate: number
  /** Name printed on invoices if different from the shop name. */
  legalName: string | null
  /** Seller address printed on invoices. Falls back to city / state. */
  businessAddress: string | null

  // ---- Contact ----
  /** Digits with country code, e.g. 919876543210. Used for every WhatsApp link. */
  whatsappNumber: string
  email: string | null
  /** Number customers can call, display format e.g. "+91 98765 43210". Same as WhatsApp unless the owner set another. */
  phone: string | null
  /** true = the calling number is the WhatsApp number (default). false = `phone` is a separate number. */
  phoneSameAsWhatsapp: boolean
  city: string | null
  region: string | null
  instagramUrl: string | null
  facebookUrl: string | null

  // ---- Orders ----
  /** Letters before the order number, e.g. "KK" → KK-7F3K9Q. */
  orderCodePrefix: string
  /** Unpaid orders are cancelled automatically after this many hours (stock goes back on sale). 0 = never. */
  unpaidOrderExpiryHours: number
  /** Customers can ask for a return within this many days after delivery. 0 = returns are not accepted. */
  returnWindowDays: number

  // ---- Delivery ----
  /** Flat delivery charge (₹) added to every order. */
  deliveryFee: number
  /** Orders at or above this item subtotal (₹) get free delivery. 0 = delivery is never free. */
  freeDeliveryAbove: number

  // ---- Payment ----
  /** UPI ID customers pay to (e.g. "shop@okhdfcbank"). null until set. */
  upiId: string | null
  /** Name shown in the customer's UPI app when paying. */
  upiPayeeName: string | null
}
