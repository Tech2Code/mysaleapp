import { z } from "zod"

/** Form inputs give "" (or NaN) for empty number fields; numeric strings are converted. */
export const toNumberOrUndefined = (v: unknown) => {
  if (v === "" || v === null || v === undefined) return undefined
  const n = typeof v === "string" ? Number(v) : v
  return typeof n === "number" && Number.isNaN(n) ? undefined : n
}

/** A required number field that accepts "12.5" typed into an <input>. */
export const requiredNumber = (message: string) =>
  z.preprocess(toNumberOrUndefined, z.number({ error: message }))

/** An optional number field: empty input becomes null. */
export const optionalNumber = z.preprocess((v) => toNumberOrUndefined(v) ?? null, z.number().nullable())
