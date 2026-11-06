/** States and union territories, as shown in the State dropdown. */
export const INDIAN_STATES = [
  "Andaman and Nicobar Islands",
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chandigarh",
  "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu and Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Ladakh",
  "Lakshadweep",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Puducherry",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
] as const

export type IndianState = (typeof INDIAN_STATES)[number]

export const STATE_OPTIONS = INDIAN_STATES.map((s) => ({ value: s, label: s }))

/** "Nothing chosen yet" for a form field typed as IndianState. The schema rejects it, so it can't be submitted. */
export const NO_STATE = "" as IndianState

const norm = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/\s+/g, " ").trim()

/** Maps a state name from any source ("JAMMU & KASHMIR", "Orissa") to our list. null when unknown. */
export function matchState(name: string): IndianState | null {
  const n = norm(name)
  const aliases: Record<string, IndianState> = { orissa: "Odisha", pondicherry: "Puducherry", "dadra and nagar haveli": "Dadra and Nagar Haveli and Daman and Diu", "daman and diu": "Dadra and Nagar Haveli and Daman and Diu" }
  return INDIAN_STATES.find((s) => norm(s) === n) ?? aliases[n] ?? null
}

/*
 * The database has one `city` column. The state is kept inside it as "City, State", so every place that
 * shows an address (order page, admin, WhatsApp message, address book) shows the state without extra work.
 * Forms edit city and state separately: split on the way in, join on the way out (server actions).
 */
export function joinCityState(city: string, state: string): string {
  return `${city.trim()}, ${state}`
}

export function splitCityState(stored: string): { city: string; state: IndianState } {
  for (const state of INDIAN_STATES) {
    const tail = `, ${state}`
    if (stored.endsWith(tail)) return { city: stored.slice(0, -tail.length), state }
  }
  return { city: stored, state: NO_STATE }
}
