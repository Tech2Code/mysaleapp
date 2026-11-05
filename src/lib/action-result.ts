/** Uniform return type for every Server Action in the app. */
export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { data?: undefined } : { data: T }))
  | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> }

export function fail(error: string, fieldErrors?: Record<string, string[] | undefined>) {
  return { ok: false as const, error, fieldErrors }
}
