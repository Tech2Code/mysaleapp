/**
 * "Other" is only useful if it says what the other reason is. Every reason dropdown that has an "Other"
 * (customer cancel, admin cancel, return request) uses this one rule, on the form and on the server.
 */
export const OTHER_REASON = "Other"
export const OTHER_DETAIL_MIN = 5

export const OTHER_DETAIL_MESSAGE = `Tell us the reason (at least ${OTHER_DETAIL_MIN} letters)`

const CANCEL_UPI_TAG_RE = /\s*\[Refund UPI:\s*([^\]]+)\]\s*$/i

/** What is stored and shown to the customer: "Other" is replaced by what was written; a listed reason gets the extra words after it. */
export function cancelReasonText(reason: string, detail: string | undefined, refundUpiId?: string | null): string {
  const cleanDetail = (detail ?? "").replace(CANCEL_UPI_TAG_RE, "").trim()
  const base = reason === OTHER_REASON ? cleanDetail || reason : cleanDetail ? `${reason}: ${cleanDetail}` : reason
  const cleanUpi = (refundUpiId ?? "").trim()
  if (!cleanUpi) return base
  const tag = ` [Refund UPI: ${cleanUpi}]`
  const maxBase = Math.max(20, 200 - tag.length)
  return `${base.slice(0, maxBase).trim()}${tag}`
}

/** Splits a stored cancellation reason into the visible reason text and any customer-supplied refund UPI ID. */
export function splitCancelReason(raw: string | null | undefined): {
  reason: string | null
  refundUpiId: string | null
} {
  if (!raw) return { reason: null, refundUpiId: null }
  const match = raw.match(CANCEL_UPI_TAG_RE)
  if (!match) return { reason: raw.trim() || null, refundUpiId: null }
  const refundUpiId = match[1]?.trim() || null
  const reason = raw.replace(CANCEL_UPI_TAG_RE, "").trim() || null
  return { reason, refundUpiId }
}

/** true when `reason` is "Other" and the comment is too short to be a real explanation. */
export function otherNeedsDetail(reason: string, detail: string | undefined | null): boolean {
  return reason === OTHER_REASON && (detail ?? "").replace(CANCEL_UPI_TAG_RE, "").trim().length < OTHER_DETAIL_MIN
}
