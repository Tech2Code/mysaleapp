import { z } from "zod"

/** What "Data & launch" can wipe. Shared by the admin panel (browser) and the server action. */
export const RESET_SCOPES = ["orders", "customers", "catalog"] as const
export type ResetScope = (typeof RESET_SCOPES)[number]

export const RESET_SCOPE_INFO: Record<ResetScope, { label: string; description: string }> = {
  orders: { label: "Orders", description: "Every order and its status history. Order numbers start fresh." },
  customers: { label: "Customers' saved data", description: "Saved addresses and wishlists. Sign-in accounts are kept." },
  catalog: { label: "Products & categories", description: "Every product, category and uploaded product photo. Your catalogue becomes empty." },
}

/** The word the admin must type before anything is deleted. */
export const RESET_CONFIRM_WORD = "RESET"

export const resetSchema = z.object({
  scopes: z.array(z.enum(RESET_SCOPES)).min(1, "Choose what to clear"),
  confirm: z.literal(RESET_CONFIRM_WORD, { error: `Type ${RESET_CONFIRM_WORD} to confirm` }),
})

export type LaunchCounts = { orders: number; products: number; categories: number; addresses: number; wishlists: number }
