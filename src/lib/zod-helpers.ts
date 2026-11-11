import { z } from "zod"

/** Form inputs give "" (or NaN) for empty number fields; numeric strings are converted. */
export const toNumberOrUndefined = (v: unknown) => {
  if (v === null || v === undefined) return undefined
  if (typeof v === "string") {
    const trimmed = v.trim()
    if (!trimmed) return undefined
    const parsed = Number(trimmed)
    return Number.isNaN(parsed) ? undefined : parsed
  }
  return typeof v === "number" && Number.isNaN(v) ? undefined : v
}

/** A required number field that accepts "12.5" typed into an <input>. */
export const requiredNumber = (message: string) =>
  z.preprocess(toNumberOrUndefined, z.number({ error: message }))

/** Rupee amounts have at most 2 decimals ("12.345" is refused; tolerant of float noise like 0.1 * 3). */
export const hasMaxTwoDecimals = (n: number) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6

/** An optional number field: empty input becomes null. */
export const optionalNumber = z.preprocess((v) => toNumberOrUndefined(v) ?? null, z.number().nullable())
