import { ImageResponse } from "next/og"
import { getStoreSettings } from "@/features/settings/queries"
import { BrandMark } from "@/lib/brand-image"

export const size = { width: 64, height: 64 }
export const contentType = "image/png"

export default async function Icon() {
  const { shopName } = await getStoreSettings()
  return new ImageResponse(<BrandMark size={64} letter={shopName} />, size)
}
