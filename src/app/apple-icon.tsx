import { ImageResponse } from "next/og"
import { getStoreSettings } from "@/features/settings/queries"
import { resolveThemeBrandPalette } from "@/features/settings/theme"
import { BrandMark } from "@/lib/brand-image"

export const size = { width: 180, height: 180 }
export const contentType = "image/png"

export default async function AppleIcon() {
  const s = await getStoreSettings()
  const palette = resolveThemeBrandPalette(s.themePreset, s.themeCustom)
  return new ImageResponse(<BrandMark size={180} variant="maskable" palette={palette} />, size)
}
