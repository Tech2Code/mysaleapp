"use server"

import { z } from "zod"
import { limited } from "@/features/security/rate-limit"
import { PATTERNS } from "@/lib/validation"
import { matchState, type IndianState } from "./states"

export type PincodeInfo = { ok: true; city: string; state: IndianState } | { ok: false }

// India Post's free public lookup. Third-party data, so it is parsed strictly and never trusted blindly.
const responseSchema = z.array(
  z.object({
    Status: z.string(),
    PostOffice: z.array(z.object({ District: z.string(), State: z.string() })).nullable(),
  })
)

const titleCase = (s: string) =>
  s
    .toLowerCase()
    .replace(/\b[a-z]/g, (c) => c.toUpperCase())
    .trim()

/** City (district) and state for a 6-digit pincode. `{ ok: false }` when unknown or the lookup is unavailable. */
export async function lookupPincode(pincode: string): Promise<PincodeInfo> {
  if (!PATTERNS.pincode.test(pincode)) return { ok: false }
  if (await limited("pincode")) {
    console.warn("[pincode] rate limited")
    return { ok: false }
  }
  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${pincode}`, { signal: AbortSignal.timeout(4000) })
    if (!res.ok) {
      console.warn(`[pincode] upstream returned HTTP ${res.status}`)
      return { ok: false }
    }
    const parsed = responseSchema.safeParse(await res.json())
    const office = parsed.success ? parsed.data[0]?.PostOffice?.[0] : undefined
    if (!parsed.success || parsed.data[0]?.Status !== "Success" || !office) return { ok: false }
    const state = matchState(office.State)
    if (!state) return { ok: false }
    return { ok: true, city: titleCase(office.District).slice(0, 60), state }
  } catch (e) {
    console.warn("[pincode] lookup failed:", e instanceof Error ? e.name : "unknown error")
    return { ok: false }
  }
}
