import { BRAND_PALETTE, BrandGlyph } from "@/components/shared/brand-glyph"

export type BrandMarkVariant = "badge" | "maskable"

/**
 * Shared JSX for generated icons (rendered by next/og ImageResponse for favicon, Apple icon,
 * PWA icons, and OG image).
 *
 * - `badge`: rounded-square brand mark matching the header LogoMark (optionally inset with
 *   transparent padding so Android's native PWA splash screen renders it at a refined size).
 * - `maskable`: full-bleed edge-to-edge brand gradient with the glyph centered inside the
 *   80% safe zone (required for Android adaptive icons and iOS apple-touch-icon).
 */
export function BrandMark({
  size,
  padding = 0,
  variant = "badge",
}: {
  size: number
  padding?: number
  variant?: BrandMarkVariant
}) {
  if (variant === "maskable") {
    const glyphSize = Math.round(size * 0.56)
    return (
      <div
        style={{
          width: size,
          height: size,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: BRAND_PALETTE.gradient,
        }}
      >
        <BrandGlyph
          size={glyphSize}
          boxColor={BRAND_PALETTE.boxColor}
          ribbon={BRAND_PALETTE.ribbon}
          accent={BRAND_PALETTE.accent}
        />
      </div>
    )
  }

  const inner = size - padding * 2
  const radius = Math.round(inner * 0.28)
  const border = Math.max(1, Math.round(inner * 0.025))
  const glyphSize = Math.round(inner * 0.64)

  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "transparent",
      }}
    >
      <div
        style={{
          width: inner,
          height: inner,
          borderRadius: radius,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: BRAND_PALETTE.gradient,
          border: `${border}px solid ${BRAND_PALETTE.borderColor}`,
        }}
      >
        <BrandGlyph
          size={glyphSize}
          boxColor={BRAND_PALETTE.boxColor}
          ribbon={BRAND_PALETTE.ribbon}
          accent={BRAND_PALETTE.accent}
        />
      </div>
    </div>
  )
}
