import { ImageResponse } from "next/og"
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

/** PWA icons (the brand glyph, independent of the shop name). */
export async function GET(_req: Request, { params }: RouteContext<"/icons/[size]">) {
  const { size } = await params
  const v = VARIANTS[size]
  if (!v) return new Response("Not found", { status: 404 })
  return new ImageResponse(<BrandMark size={v.size} padding={v.padding} />, { width: v.size, height: v.size })
}
