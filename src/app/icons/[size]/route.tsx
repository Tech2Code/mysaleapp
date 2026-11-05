import { ImageResponse } from "next/og"
import { getStoreSettings } from "@/features/settings/queries"
import { BrandMark } from "@/lib/brand-image"

const VARIANTS: Record<string, { size: number; padding: number }> = {
  "192": { size: 192, padding: 0 },
  "512": { size: 512, padding: 0 },
  // Maskable icons need a safe zone: Android may crop them into a circle.
  "maskable-512": { size: 512, padding: 64 },
}

export function generateStaticParams() {
  return Object.keys(VARIANTS).map((size) => ({ size }))
}

/** PWA icons. The letter comes from the shop name in Admin → Settings. */
export async function GET(_req: Request, { params }: RouteContext<"/icons/[size]">) {
  const { size } = await params
  const v = VARIANTS[size]
  if (!v) return new Response("Not found", { status: 404 })
  const { shopName } = await getStoreSettings()
  return new ImageResponse(<BrandMark size={v.size} padding={v.padding} letter={shopName} />, { width: v.size, height: v.size })
}
