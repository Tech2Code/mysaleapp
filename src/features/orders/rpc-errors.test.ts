import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { mapRpcError } from "./rpc-errors"

// Every code in the table, read from the source so a newly added code is covered automatically.
const source = readFileSync(new URL("./rpc-errors.ts", import.meta.url), "utf8")
const codes = [...source.matchAll(/^\s{2}([A-Z_]+):\s*"/gm)].map((m) => m[1])

describe("mapRpcError", () => {
  it("found the codes", () => expect(codes.length).toBeGreaterThan(25))

  it.each(codes)("%s maps to its own message, not the fallback", (c) => {
    const msg = mapRpcError(`P0001: ${c}`, "FALLBACK")
    expect(msg).not.toBe("FALLBACK")
    expect(msg.length).toBeGreaterThan(10)
  })

  it("every code has a distinct message", () => {
    const msgs = codes.map((c) => mapRpcError(c, "FALLBACK"))
    expect(new Set(msgs).size).toBe(codes.length)
  })

  it("unknown or empty messages use the fallback", () => {
    expect(mapRpcError("connection reset", "FALLBACK")).toBe("FALLBACK")
    expect(mapRpcError("", "FALLBACK")).toBe("FALLBACK")
  })

  it("matches the code anywhere in the message", () => {
    expect(mapRpcError("ERROR: ORDER_NOT_FOUND (SQLSTATE P0001)", "x")).toMatch(/find that order/)
  })
})
