/**
 * Builds a UPI deep link. On a phone it opens the customer's UPI app with the
 * amount and a note pre-filled; the same string works as the QR code content.
 * https://www.npci.org.in/ (UPI linking specification)
 */
export function buildUpiUrl(input: { upiId: string; payeeName?: string | null; amount: number; orderCode: string }): string {
  const params = new URLSearchParams({
    pa: input.upiId.trim(),
    pn: input.payeeName?.trim() || "Shop",
    am: Math.max(0, input.amount).toFixed(2),
    cu: "INR",
    tn: `Order ${input.orderCode}`,
  })
  // URLSearchParams encodes spaces as "+" and "@" as "%40"; UPI apps expect "%20" and literal "@" in VPA.
  return `upi://pay?${params.toString().replace(/\+/g, "%20").replace(/%40/gi, "@")}`
}
