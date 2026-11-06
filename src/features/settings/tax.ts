import type { StoreSettings } from "./types"

type TaxSettings = Pick<StoreSettings, "gstRegistered" | "gstin" | "gstRate" | "priceNote">

/** GST is "on" only when the owner is registered AND has filled the GSTIN and rate (the form enforces both). */
export function gstActive(s: Pick<StoreSettings, "gstRegistered" | "gstin" | "gstRate">): boolean {
  return s.gstRegistered && Boolean(s.gstin) && s.gstRate > 0
}

/** Line shown under the price on product pages, or null for none. The owner's own text always wins. */
export function priceNote(s: TaxSettings): string | null {
  if (s.priceNote) return s.priceNote
  return gstActive(s) ? "Inclusive of all taxes" : null
}

/** Unregistered sellers issue a Bill of Supply (no tax); registered ones a Tax Invoice. */
export function invoiceTitle(s: Pick<StoreSettings, "gstRegistered" | "gstin" | "gstRate">): "Tax Invoice" | "Bill of Supply" {
  return gstActive(s) ? "Tax Invoice" : "Bill of Supply"
}

const round2 = (n: number) => Math.round(n * 100) / 100

/** Prices already include GST: split an amount into the taxable value and the GST inside it. */
export function gstIncluded(amount: number, ratePercent: number): { taxable: number; gst: number } {
  const gst = round2((amount * ratePercent) / (100 + ratePercent))
  return { taxable: round2(amount - gst), gst }
}
