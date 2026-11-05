import { ImageResponse } from "next/og"
import { getStoreSettings } from "@/features/settings/queries"
import { BrandMark } from "@/lib/brand-image"

export const size = { width: 180, height: 180 }
export const contentType = "image/png"

export default async function AppleIcon() {
  const { shopName } = await getStoreSettings()
  return new ImageResponse(<BrandMark size={180} padding={18} letter={shopName} />, size)
}
