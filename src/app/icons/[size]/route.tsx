import { ImageResponse } from "next/og"
import { BrandMark, type BrandMarkVariant } from "@/lib/brand-image"

const VARIANTS: Record<string, { size: number; padding: number; variant: BrandMarkVariant }> = {
  // Inset rounded-square badge so Android's native PWA splash screen & shortcuts stay crisp and proportional.
  "192": { size: 192, padding: 26, variant: "badge" },
  "512": { size: 512, padding: 72, variant: "badge" },
  // Full-bleed gradient with glyph inside the 80% safe zone so Android adaptive masks never clip or show cream corners.
  "maskable-512": { size: 512, padding: 0, variant: "maskable" },
}

export function generateStaticParams() {
  return Object.keys(VARIANTS).map((size) => ({ size }))
}

/** PWA icons (the brand glyph, independent of the shop name). */
export async function GET(_req: Request, { params }: RouteContext<"/icons/[size]">) {
  const { size } = await params
  if (!Object.hasOwn(VARIANTS, size)) return new Response("Not found", { status: 404 })
  const v = VARIANTS[size]
  return new ImageResponse(<BrandMark size={v.size} padding={v.padding} variant={v.variant} />, {
    width: v.size,
    height: v.size,
    headers: { "Cache-Control": "public, max-age=3600, must-revalidate" },
  })
}
