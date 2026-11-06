/**
 * "Other" is only useful if it says what the other reason is. Every reason dropdown that has an "Other"
 * (customer cancel, admin cancel, return request) uses this one rule, on the form and on the server.
 */
export const OTHER_REASON = "Other"
export const OTHER_DETAIL_MIN = 5

export const OTHER_DETAIL_MESSAGE = `Tell us the reason (at least ${OTHER_DETAIL_MIN} letters)`

/** What is stored and shown to the customer: "Other" is replaced by what was written; a listed reason gets the extra words after it. */
export function cancelReasonText(reason: string, detail: string | undefined): string {
  if (reason === OTHER_REASON) return detail ?? reason
  return detail ? `${reason}: ${detail}` : reason
}

/** true when `reason` is "Other" and the comment is too short to be a real explanation. */
export function otherNeedsDetail(reason: string, detail: string | undefined | null): boolean {
  return reason === OTHER_REASON && (detail ?? "").trim().length < OTHER_DETAIL_MIN
}
