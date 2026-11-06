import { describe, expect, it } from "vitest"
import { FIELD_KINDS, PATTERNS, v } from "./index"

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
