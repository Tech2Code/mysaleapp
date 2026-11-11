import { describe, expect, it } from "vitest"
import { safeExternalUrl, safeNextPath } from "@/lib/safe-redirect"
import { toNumberOrUndefined } from "@/lib/zod-helpers"
import { FIELD_KINDS, PATTERNS, addDays, todayIST, v } from "./index"

const ok = (s: { safeParse: (x: unknown) => { success: boolean } }, x: unknown) => s.safeParse(x).success

describe("phone", () => {
  const san = FIELD_KINDS.phone.sanitize!
  it("sanitises prefixes and punctuation", () => {
    expect(san("+91 98765-43210")).toBe("9876543210")
    expect(san("098765 43210")).toBe("9876543210")
    expect(san("98765abc43210999")).toBe("9876543210")
  })
  it("v.phoneIN accepts valid and rejects invalid", () => {
    expect(ok(v.phoneIN(), "+91 98765 43210")).toBe(true)
    expect(ok(v.phoneIN(), "5876543210")).toBe(false)
    expect(ok(v.phoneIN(), "98765")).toBe(false)
    expect(ok(v.phoneIN(), "")).toBe(false)
  })
  it("pattern", () => {
    expect(PATTERNS.indianPhone.test("6000000000")).toBe(true)
    expect(PATTERNS.indianPhone.test("5999999999")).toBe(false)
  })
})

describe("money", () => {
  const san = FIELD_KINDS.money.sanitize!
  it("keeps digits and one dot with two decimals", () => {
    expect(san("12.345")).toBe("12.34")
    expect(san("₹1,234.5.6")).toBe("1234.56")
    expect(san("abc")).toBe("")
  })
  it("v.money validates", () => {
    expect(ok(v.money(), "12.5")).toBe(true)
    expect(ok(v.money(), "")).toBe(false)
    expect(ok(v.money(), "-1")).toBe(false)
    expect(ok(v.money(), 1_000_001)).toBe(false)
    expect(ok(v.money(), 0)).toBe(true)
  })
})

describe("utr", () => {
  it("uppercases and enforces 8-35 alphanumerics", () => {
    expect(v.utr().parse(" abc12345 ")).toBe("ABC12345")
    expect(ok(v.utr(), "abc1234")).toBe(false)
    expect(ok(v.utr(), "A".repeat(36))).toBe(false)
    expect(ok(v.utr(), "ABC-12345")).toBe(false)
    expect(FIELD_KINDS.paymentRef.sanitize!("ab-c 12345")).toBe("ABC12345")
  })
})

describe("pincode", () => {
  it("is 6 digits, not starting with 0", () => {
    expect(ok(v.pincode(), "400001")).toBe(true)
    expect(ok(v.pincode(), "040001")).toBe(false)
    expect(ok(v.pincode(), "40001")).toBe(false)
    expect(ok(v.pincode(), "4000011")).toBe(false)
    expect(FIELD_KINDS.pincode.sanitize!("4000 01 99")).toBe("400001")
  })
})

describe("orderCode / last4", () => {
  it("parses uppercase code", () => {
    expect(v.orderCode().parse(" kk-ab12cd ")).toBe("KK-AB12CD")
    expect(ok(v.orderCode(), "KK-AB12C")).toBe(false)
    expect(ok(v.orderCode(), "KKKKKK-AB12CD")).toBe(false)
    expect(ok(v.orderCode(), "KKAB12CD")).toBe(false)
  })
  it("last4", () => {
    expect(ok(v.orderLast4(), "1234")).toBe(true)
    expect(ok(v.orderLast4(), "123")).toBe(false)
    expect(ok(v.orderLast4(), "12a4")).toBe(false)
  })
})

describe("upiId", () => {
  it("accepts name@bank only", () => {
    expect(ok(v.upiId(), "shop.name-1@okhdfc")).toBe(true)
    expect(ok(v.upiId(), "shop")).toBe(false)
    expect(ok(v.upiId(), "a@b")).toBe(false)
    expect(ok(v.upiId(), "shop@ok bank")).toBe(false)
  })
})

describe("newPassword", () => {
  it("requires a digit and a letter", () => {
    expect(ok(v.newPassword(), "abcdefgd")).toBe(false)
    expect(ok(v.newPassword(), "abcdefg1")).toBe(true)
    expect(ok(v.newPassword(), "12345678")).toBe(false)
    expect(ok(v.newPassword(), "abc1")).toBe(false)
    expect(ok(v.newPassword(), "a".repeat(200) + "1")).toBe(false)
  })
  it("login password stays lenient", () => {
    expect(ok(v.password(), "abcdef")).toBe(true)
    expect(ok(v.password(), "abcde")).toBe(false)
  })
})

describe("personName", () => {
  it("accepts letters from any script and . ' -", () => {
    for (const n of ["Asha", "O'Neil", "Anne-Marie", "J. Doe", "आशा शर्मा", "José"]) expect(ok(v.personName(), n)).toBe(true)
  })
  it("rejects digits, symbols, short and long", () => {
    for (const n of ["A", "R2D2", "<b>x</b>", " ", "-Ann", "a".repeat(81)]) expect(ok(v.personName(), n)).toBe(false)
  })
  it("sanitiser strips bad characters and collapses spaces", () => {
    expect(FIELD_KINDS.personName.sanitize!("Ra<j>1  Kumar")).toBe("Raj Kumar")
  })
})

describe("tracking number", () => {
  const san = FIELD_KINDS.trackingNumber.sanitize!
  it("is upper-cased and trimmed", () => {
    expect(v.trackingNumber().parse("  dtdc1234  ")).toBe("DTDC1234")
    expect(v.trackingNumber().parse("ee123456789in")).toBe("EE123456789IN")
  })
  it("rejects too short, too long, spaces and symbols", () => {
    expect(ok(v.trackingNumber(), "ABCD")).toBe(false) // 4
    expect(ok(v.trackingNumber(), "ABCDE")).toBe(true) // 5
    expect(ok(v.trackingNumber(), "A".repeat(30))).toBe(true)
    expect(ok(v.trackingNumber(), "A".repeat(31))).toBe(false)
    expect(ok(v.trackingNumber(), "AB CD 12345")).toBe(false)
    expect(ok(v.trackingNumber(), "AWB#12345")).toBe(false)
    expect(ok(v.trackingNumber(), "-ABC12345")).toBe(false)
    expect(ok(v.trackingNumber(), "AB-12/34_5")).toBe(true)
  })
  it("the input mask removes spaces and symbols and upper-cases", () => {
    expect(san("ab 12-3/4_5!#")).toBe("AB12-3/4_5")
  })
  it("pattern", () => {
    expect(PATTERNS.trackingNumber.test("AWB0123123")).toBe(true)
    expect(PATTERNS.trackingNumber.test("awb0123123")).toBe(false)
  })
})

describe("money decimals", () => {
  it("accepts at most 2 decimals", () => {
    expect(ok(v.money(), "12.34")).toBe(true)
    expect(ok(v.money(), "12.345")).toBe(false)
    expect(ok(v.money(), 0.1 * 3)).toBe(true) // float noise is tolerated
  })
  it("optionalMoney: blank is null, bounds and decimals apply", () => {
    const m = v.optionalMoney(100)
    expect(m.parse("")).toBeNull()
    expect(m.parse("99.5")).toBe(99.5)
    expect(ok(m, "100.01")).toBe(false)
    expect(ok(m, "-1")).toBe(false)
    expect(ok(m, "1.234")).toBe(false)
    expect(ok(m, "abc")).toBe(true) // NaN-like text is treated as blank
  })
})

describe("urls, dates, quantities", () => {
  it("httpsUrl refuses http and other schemes", () => {
    expect(ok(v.httpsUrl(), "https://track.example.com/x?id=1")).toBe(true)
    expect(ok(v.httpsUrl(), "http://track.example.com")).toBe(false)
    expect(ok(v.httpsUrl(), "javascript:alert(1)")).toBe(false)
    expect(ok(v.httpsUrl(), `https://a.com/${"x".repeat(300)}`)).toBe(false)
  })
  it("isoDate needs a real calendar day", () => {
    expect(ok(v.isoDate(), "2026-02-28")).toBe(true)
    expect(ok(v.isoDate(), "2026-02-31")).toBe(false)
    expect(ok(v.isoDate(), "2026-13-01")).toBe(false)
    expect(ok(v.isoDate(), "26-1-1")).toBe(false)
  })
  it("futureDate: today..+N days", () => {
    const today = todayIST()
    expect(ok(v.futureDate(90), today)).toBe(true)
    expect(ok(v.futureDate(90), addDays(today, 90))).toBe(true)
    expect(ok(v.futureDate(90), addDays(today, 91))).toBe(false)
    expect(ok(v.futureDate(90), addDays(today, -1))).toBe(false)
  })
  it("quantity 1..20 whole numbers", () => {
    expect(ok(v.quantity(), 1)).toBe(true)
    expect(ok(v.quantity(), 20)).toBe(true)
    expect(ok(v.quantity(), 0)).toBe(false)
    expect(ok(v.quantity(), 21)).toBe(false)
    expect(ok(v.quantity(), 1.5)).toBe(false)
  })
  it("email is lower-cased and trimmed", () => {
    expect(v.email().parse("  Shop@Example.COM ")).toBe("shop@example.com")
  })
  it("displayPhone needs 7-15 digits", () => {
    expect(ok(v.displayPhone(), "+91 98765 43210")).toBe(true)
    expect(ok(v.displayPhone(), "12345")).toBe(false)
    expect(ok(v.displayPhone(), "call me maybe 1234567")).toBe(false)
  })
  it("v.phoneIN normalises formatted Indian numbers to 10 digits", () => {
    expect(v.phoneIN().parse("+91 98765 43210")).toBe("9876543210")
  })
  it("v.city allows India Post district names with digits and parentheses", () => {
    expect(ok(v.city(), "North 24 Parganas")).toBe(true)
    expect(ok(v.city(), "Mumbai (Suburban)")).toBe(true)
    expect(ok(v.city(), "<b>City</b>")).toBe(false)
  })
  it("toNumberOrUndefined treats whitespace-only strings as undefined", () => {
    expect(toNumberOrUndefined("   ")).toBeUndefined()
    expect(toNumberOrUndefined("0")).toBe(0)
  })
  it("safeNextPath and safeExternalUrl block loops and unsafe schemes", () => {
    expect(safeNextPath("/login")).toBe("/")
    expect(safeNextPath("/admin/login?next=/admin")).toBe("/")
    expect(safeNextPath("//evil.com")).toBe("/")
    expect(safeNextPath("/account/orders?tab=1")).toBe("/account/orders?tab=1")
    expect(safeExternalUrl("javascript:alert(1)")).toBeNull()
    expect(safeExternalUrl("http://example.com", true)).toBeNull()
    expect(safeExternalUrl("https://instagram.com/shop")).toBe("https://instagram.com/shop")
  })
})
