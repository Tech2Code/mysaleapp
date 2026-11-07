import { BrandGlyph } from "@/components/shared/brand-glyph"

/** Shared JSX for generated icons (rendered by next/og ImageResponse). */
export function BrandMark({ size, padding = 0 }: { size: number; padding?: number }) {
  const inner = size - padding * 2
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
          borderRadius: padding ? inner * 0.5 : inner * 0.22,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #c0643c 0%, #b34a4f 100%)",
        }}
      >
        <div style={{ display: "flex", color: "#fff8f0" }}><BrandGlyph size={Math.round(inner * 0.66)} /></div>
      </div>
    </div>
  )
}
