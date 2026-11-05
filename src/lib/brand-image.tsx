import { siteConfig } from "@/config/site"

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
          color: "#fff8f0",
          fontSize: inner * 0.58,
          fontWeight: 700,
          fontFamily: "serif",
        }}
      >
        {siteConfig.name.charAt(0)}
      </div>
    </div>
  )
}
