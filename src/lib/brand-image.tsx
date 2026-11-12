import { BrandGlyph } from "@/components/shared/brand-glyph"

/** Shared JSX for generated icons (rendered by next/og ImageResponse for favicon, Apple icon, and PWA icons). */
export function BrandMark({ size, padding = 0 }: { size: number; padding?: number }) {
  const inner = size - padding * 2
  const radius = Math.round(padding ? inner * 0.46 : inner * 0.25)
  const border = Math.max(1, Math.round(inner * 0.025))
  const glyphSize = Math.round(inner * 0.74)

  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: padding ? "#fbf7f2" : "transparent",
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
          background: "linear-gradient(140deg, #dc6d38 0%, #c04e3f 48%, #8c2836 100%)",
          border: `${border}px solid rgba(255, 238, 214, 0.32)`,
          boxShadow: "inset 0 2px 6px rgba(255, 255, 255, 0.22)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fffaf4",
          }}
        >
          <BrandGlyph size={glyphSize} ribbon="#fbd07c" accent="#9a2f38" />
        </div>
      </div>
    </div>
  )
}
