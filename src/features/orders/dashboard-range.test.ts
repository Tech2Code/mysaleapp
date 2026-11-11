import { describe, expect, it } from "vitest"
import { fyOptions, monthOptions, resolveRange } from "./dashboard-range"

const at = (iso: string) => new Date(iso)

describe("resolveRange default (financial year)", () => {
  it("IST edge: 18:29:59Z is still 31 Mar, 18:30:00Z is 1 Apr", () => {
    const before = resolveRange({}, at("2026-03-31T18:29:59Z"))
    expect(before.label).toBe("FY 2025-26")
    expect(before.to).toBe("2026-03-31")
    const after = resolveRange({}, at("2026-03-31T18:30:00Z"))
    expect(after.label).toBe("FY 2026-27")
    expect(after.from).toBe("2026-04-01")
    expect(after.start.toISOString()).toBe("2026-03-31T18:30:00.000Z")
  })
  it("compares with the same stretch of last year", () => {
    const r = resolveRange({}, at("2026-11-06T06:00:00Z"))
    expect(r.key).toBe("fy")
    expect(r.from).toBe("2026-04-01")
    expect(r.to).toBe("2026-11-06")
    expect(r.previous?.start.toISOString()).toBe("2025-03-31T18:30:00.000Z")
    const span = r.end.getTime() - r.start.getTime()
    expect(r.previous!.end.getTime() - r.previous!.start.getTime()).toBe(span)
    expect(r.bucket).toBe("month")
  })
  it("on 1 April the previous range is one day", () => {
    const r = resolveRange({}, at("2026-04-01T06:00:00Z"))
    expect(r.bucket).toBe("day")
    expect(r.previous!.end.getTime() - r.previous!.start.getTime()).toBe(86_400_000)
  })
  it("compares a leap-year FY correctly", () => {
    const r = resolveRange({ fy: "2023" }, at("2026-11-06T06:00:00Z"))
    expect(r.label).toBe("FY 2023-24")
    expect(r.from).toBe("2023-04-01")
    expect(r.to).toBe("2024-03-31")
    expect((r.end.getTime() - r.start.getTime()) / 86_400_000).toBe(366)
    expect(r.previous?.start.toISOString()).toBe("2022-03-31T18:30:00.000Z")
  })
  it("ignores fy for the current/future year or garbage", () => {
    for (const fy of ["2026", "2030", "abc", "26"]) expect(resolveRange({ fy }, at("2026-11-06T06:00:00Z")).key).toBe("fy")
  })
})

describe("?month=", () => {
  const now = at("2026-11-06T06:00:00Z")
  it("a past month is whole, compared with the month before", () => {
    const r = resolveRange({ month: "2026-03" }, now)
    expect(r.key).toBe("pick-month")
    expect(r.label).toBe("March 2026")
    expect(r.from).toBe("2026-03-01")
    expect(r.to).toBe("2026-03-31")
    expect(r.previous?.start.toISOString()).toBe("2026-01-31T18:30:00.000Z")
  })
  it("the running month stops at today", () => {
    const r = resolveRange({ month: "2026-11" }, now)
    expect(r.to).toBe("2026-11-06")
  })
  it("a future month falls back to the default", () => {
    expect(resolveRange({ month: "2027-01" }, now).key).toBe("fy")
  })
  it("invalid months fall back to the default", () => {
    for (const month of ["2026-13", "2026-00", "2026-1", "nope"]) expect(resolveRange({ month }, now).key).toBe("fy")
  })
})

describe("custom from/to", () => {
  const now = at("2026-11-06T06:00:00Z")
  it("swaps when from > to", () => {
    const r = resolveRange({ from: "2026-05-10", to: "2026-05-01" }, now)
    expect(r.key).toBe("custom")
    expect(r.from).toBe("2026-05-01")
    expect(r.to).toBe("2026-05-10")
  })
  it("single day gets one date as label", () => {
    const r = resolveRange({ from: "2026-05-01", to: "2026-05-01" }, now)
    expect(r.label).not.toContain("–")
    expect(r.previous!.end.getTime()).toBe(r.start.getTime())
  })
  it("ignores impossible dates like 2026-02-31", () => {
    expect(resolveRange({ from: "2026-02-31", to: "2026-03-05" }, now).key).toBe("fy")
    expect(resolveRange({ from: "2026-03-01", to: "2026-13-05" }, now).key).toBe("fy")
  })
  it("ignores spans over 1100 days but accepts exactly 1100", () => {
    expect(resolveRange({ from: "1900-01-01", to: "2100-12-31" }, now).key).toBe("fy")
    // 2023-01-01 .. 2026-01-04 inclusive = 1100 days
    expect(resolveRange({ from: "2023-01-01", to: "2026-01-04" }, now).key).toBe("custom")
    expect(resolveRange({ from: "2023-01-01", to: "2026-01-05" }, now).key).toBe("fy")
    expect(resolveRange({ from: "1999-12-01", to: "1999-12-10" }, now).key).toBe("fy")
  })
  it("flips bucket above 92 days", () => {
    expect(resolveRange({ from: "2026-01-01", to: "2026-04-02" }, now).bucket).toBe("day") // 92 days
    expect(resolveRange({ from: "2026-01-01", to: "2026-04-03" }, now).bucket).toBe("month") // 93 days
  })
  it("needs both ends", () => {
    expect(resolveRange({ from: "2026-05-01" }, now).key).toBe("fy")
  })
})

describe("range=month", () => {
  it("is the current month so far", () => {
    const r = resolveRange({ range: "month" }, at("2026-11-06T06:00:00Z"))
    expect(r.key).toBe("month")
    expect(r.from).toBe("2026-11-01")
    expect(r.to).toBe("2026-11-06")
    expect(r.bucket).toBe("day")
  })
})

describe("options", () => {
  it("fyOptions lists the current and 4 previous years", () => {
    const o = fyOptions("2026-11-06")
    expect(o.map((x) => x.value)).toEqual(["2026", "2025", "2024", "2023", "2022"])
    expect(o[0].label).toBe("FY 2026-27 (current)")
    expect(fyOptions("2026-02-01")[0].value).toBe("2025")
  })
  it("fyOptions adds an out-of-list current range", () => {
    expect(fyOptions("2026-11-06", { from: "2015-04-01" }).at(-1)?.value).toBe("2015")
  })
  it("monthOptions runs April to today", () => {
    const o = monthOptions("2026-06-15", 2026)
    expect(o.map((x) => x.value)).toEqual(["all", "2026-04", "2026-05", "2026-06", "custom"])
  })
  it("monthOptions for a past FY has all 12 months crossing the year", () => {
    const o = monthOptions("2026-11-06", 2024)
    expect(o).toHaveLength(14)
    expect(o[1].value).toBe("2024-04")
    expect(o[12].value).toBe("2025-03")
  })
})
