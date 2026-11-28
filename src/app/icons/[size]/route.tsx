import { ImageResponse } from "next/og"
import { getStoreSettings } from "@/features/settings/queries"
import { resolveThemeBrandPalette } from "@/features/settings/theme"
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

/** PWA icons (synced to the active store theme). */
export async function GET(_req: Request, { params }: RouteContext<"/icons/[size]">) {
  const { size } = await params
  if (!Object.hasOwn(VARIANTS, size)) return new Response("Not found", { status: 404 })
  const v = VARIANTS[size]
  const s = await getStoreSettings()
  const palette = resolveThemeBrandPalette(s.themePreset, s.themeCustom)
  return new ImageResponse(<BrandMark size={v.size} padding={v.padding} variant={v.variant} palette={palette} />, {
    width: v.size,
    height: v.size,
    headers: { "Cache-Control": "public, max-age=3600, must-revalidate" },
  })
}
