import { BRAND_PALETTE, BrandGlyph } from "@/components/shared/brand-glyph"

/** Shared JSX for generated icons (rendered by next/og ImageResponse for favicon, Apple icon, PWA icons, and OG image). */
export function BrandMark({ size, padding = 0 }: { size: number; padding?: number }) {
  const inner = size - padding * 2
  const radius = Math.round(padding ? inner * 0.46 : inner * 0.25)
  const border = Math.max(1, Math.round(inner * 0.025))
  const glyphSize = Math.round(inner * 0.72)

  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: padding ? BRAND_PALETTE.backgroundColor : "transparent",
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
