import { describe, expect, it } from "vitest"
import { INDIAN_STATES, joinCityState, matchState, NO_STATE, splitCityState } from "./states"

describe("join/split city+state", () => {
  it("round-trips every state", () => {
    for (const s of INDIAN_STATES) expect(splitCityState(joinCityState("  Pune ", s))).toEqual({ city: "Pune", state: s })
  })
  it("handles Goa, Goa", () => {
    expect(joinCityState("Goa", "Goa")).toBe("Goa, Goa")
    expect(splitCityState("Goa, Goa")).toEqual({ city: "Goa", state: "Goa" })
  })
  it("keeps legacy values without a state suffix", () => {
    expect(splitCityState("Mumbai")).toEqual({ city: "Mumbai", state: NO_STATE })
    expect(splitCityState("Mumbai, Nowhere")).toEqual({ city: "Mumbai, Nowhere", state: NO_STATE })
  })
  it("splits long state names", () => {
    expect(splitCityState("Port Blair, Andaman and Nicobar Islands").city).toBe("Port Blair")
  })
})

describe("matchState", () => {
  it("matches case-insensitively and with &", () => {
    expect(matchState("JAMMU & KASHMIR")).toBe("Jammu and Kashmir")
    expect(matchState("  tamil   nadu ")).toBe("Tamil Nadu")
  })
  it("maps aliases", () => {
    expect(matchState("Orissa")).toBe("Odisha")
    expect(matchState("Pondicherry")).toBe("Puducherry")
    expect(matchState("Daman & Diu")).toBe("Dadra and Nagar Haveli and Daman and Diu")
    expect(matchState("Dadra and Nagar Haveli")).toBe("Dadra and Nagar Haveli and Daman and Diu")
  })
  it("returns null for unknown", () => {
    expect(matchState("Atlantis")).toBeNull()
    expect(matchState("")).toBeNull()
  })
})
