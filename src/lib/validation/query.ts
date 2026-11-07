/**
 * Next.js gives `searchParams` values as `string | string[] | undefined`: a repeated or pasted URL
 * (`?view=a&view=b`) yields an array, and feeding that to `z.string()` throws
 * "Invalid input: expected string, received array". Always pass URL values through `firstParam`
 * before they reach a schema or a query.
 */
export function firstParam(value: string | string[] | undefined | null): string | undefined {
  const first = Array.isArray(value) ? value[0] : value
  return typeof first === "string" ? first : undefined
}
