import { ImageResponse } from "next/og"
import { getStoreSettings } from "@/features/settings/queries"
import { resolveThemeBrandPalette } from "@/features/settings/theme"
import { BrandMark } from "@/lib/brand-image"

export const size = { width: 64, height: 64 }
export const contentType = "image/png"

export default async function Icon() {
  const s = await getStoreSettings()
  const palette = resolveThemeBrandPalette(s.themePreset, s.themeCustom)
  return new ImageResponse(<BrandMark size={64} palette={palette} />, size)
}
