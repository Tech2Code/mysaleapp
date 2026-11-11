import { describe, expect, it } from "vitest"
import { returnStage } from "./returns"
import { buildUpiUrl } from "./upi"
import { buildStatusUpdateMessage, whatsappLink } from "./whatsapp"
import { ORDER_VIEWS } from "./views"

const shop = { shopName: "Test Shop", whatsappNumber: "919999999999" }
const stage = (status: "requested" | "approved" | "rejected" | "received") =>
  returnStage({
    requests: [{ status, createdAt: "2026-01-01T00:00:00Z", adminNote: status === "rejected" ? "Used item" : null }],
    returns: status === "received" ? [{ refunded: true, createdAt: "2026-01-03T00:00:00Z" }] : [],
    paymentStatus: "paid",
    refundedAmount: status === "received" ? 250 : 0,
    paidAmount: 1000,
  })

describe("status WhatsApp message with a return stage", () => {
  const base = { orderCode: "KK-ABC123", customerName: "Asha Rao", status: "delivered" as const }

  it("talks about the return (customer wording, no amounts) instead of 'Delivered'", () => {
    const text = buildStatusUpdateMessage(shop, { ...base, returnStage: stage("approved") })
    expect(text).toContain("KK-ABC123")
    expect(text).toContain("*Return approved*")
    expect(text).not.toContain("now *Delivered*")
    const partly = buildStatusUpdateMessage(shop, { ...base, returnStage: stage("received") })
    expect(partly).toContain("*Partially refunded*")
    expect(partly).not.toMatch(/₹/)
  })

  it("includes the rejection reason", () => {
    expect(buildStatusUpdateMessage(shop, { ...base, returnStage: stage("rejected") })).toContain("Reason: Used item")
  })

  it("keeps the normal message without a stage or for other statuses", () => {
    expect(buildStatusUpdateMessage(shop, base)).toContain("is now *Delivered*")
    expect(buildStatusUpdateMessage(shop, { ...base, status: "shipped", returnStage: stage("approved") })).toContain("is now *Shipped*")
  })
})

describe("order views for returns", () => {
  it("has a list for requests waiting for a decision AND for approved ones waiting for the goods", () => {
    expect(Object.keys(ORDER_VIEWS)).toEqual(expect.arrayContaining(["return-requests", "returns-to-receive"]))
  })
  it("preserves literal @ in UPI pa and normalises double-91 WhatsApp phones", () => {
    const upi = buildUpiUrl({ upiId: "shop@okhdfc", payeeName: "My Shop", amount: 250.5, orderCode: "KK-ABC123" })
    expect(upi).toContain("pa=shop@okhdfc")
    expect(upi).not.toContain("pa=shop%40okhdfc")
    expect(whatsappLink("91919876543210", "Hi")).toBe("https://wa.me/919876543210?text=Hi")
  })
})
