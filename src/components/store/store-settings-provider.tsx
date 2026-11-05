"use client"

import { createContext, useContext, type ReactNode } from "react"
import { DEFAULT_SETTINGS } from "@/features/settings/defaults"
import type { StoreSettings } from "@/features/settings/types"

const StoreSettingsContext = createContext<StoreSettings>(DEFAULT_SETTINGS)

/**
 * Makes the owner-editable settings (shop name, WhatsApp number, delivery fee, UPI…) available to
 * every client component. Mounted once in the root layout. Server components call getStoreSettings() instead.
 */
export function StoreSettingsProvider({ value, children }: { value: StoreSettings; children: ReactNode }) {
  return <StoreSettingsContext value={value}>{children}</StoreSettingsContext>
}

export function useStoreSettings(): StoreSettings {
  return useContext(StoreSettingsContext)
}
