/** One message per error code raised by the order RPCs (customer and admin share them). */
const RPC_ERRORS: Record<string, string> = {
  INVALID_NAME: "Please enter a valid name.",
  INVALID_PHONE: "Please enter a valid 10-digit mobile number.",
  INVALID_ADDRESS: "Please enter your full address.",
  INVALID_CITY: "Please enter your city.",
  INVALID_PINCODE: "Please enter a valid 6-digit pincode.",
  INVALID_NOTE: "The note is too long.",
  INVALID_ITEMS: "Your cart is empty or has too many items.",
  INVALID_QUANTITY: "Each item can be ordered 1–20 at a time.",
  ITEM_UNAVAILABLE: "Some items in your cart are out of stock or no longer available. Please review your cart.",
  INVALID_REFERENCE: "That doesn't look like a UTR / UPI reference. It is usually a 12-digit number.",
  ORDER_NOT_FOUND: "We couldn't find that order.",
  ORDER_CANCELLED: "This order was cancelled.",
  ALREADY_PAID: "This order is already marked as paid.",
  DUPLICATE_REFERENCE: "This reference number was already used for another payment. Please check it and try again.",
  NOT_DELIVERED: "Returns can only be requested after the order is delivered.",
  RETURNS_OFF: "This shop isn't accepting returns right now. Please message us on WhatsApp.",
  WINDOW_CLOSED: "The return window for this order has ended. Please message us on WhatsApp.",
  REASON_REQUIRED: "Please choose a reason for the return.",
  NO_ITEMS: "Choose at least one item to return.",
  ITEM_NOT_IN_ORDER: "One of those items isn't part of this order.",
  TOO_MANY_RETURNED: "You can't return more than you ordered.",
  ALREADY_OPEN: "You already have a return request open for this order.",
  CANNOT_WITHDRAW: "This request has already been reviewed, so it can't be withdrawn.",
  ALREADY_CANCELLED: "This order is already cancelled.",
  CANNOT_CANCEL: "This order is already packed, so it can't be cancelled here. Please message us on WhatsApp.",
  TOO_MANY_ATTEMPTS: "Too many wrong attempts for this order. Please try again in 15 minutes, sign in, or message us on WhatsApp.",
  TOO_MANY_ORDERS: "Too many unpaid orders from this number. Please pay for or cancel an existing order, or message us on WhatsApp.",
  NOT_EDITABLE: "This order is already confirmed, so the delivery details can't be changed. Message us on WhatsApp for help.",
  // Admin-only codes
  REQUEST_NOT_OPEN: "That return request is no longer open.",
}

/** Friendly message for the first known code found in an RPC error message, else `fallback`. */
export function mapRpcError(message: string, fallback: string): string {
  const key = Object.keys(RPC_ERRORS).find((k) => message.includes(k))
  return key ? RPC_ERRORS[key] : fallback
}
