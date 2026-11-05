import { ImageResponse } from "next/og"
import { siteConfig } from "@/config/site"

export const alt = `${siteConfig.name} — ${siteConfig.tagline}`
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

/** Default share image (WhatsApp / Instagram / Facebook previews). */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 80,
          background: "linear-gradient(135deg, #fbf3e9 0%, #f6dcd2 55%, #f3e6c8 100%)",
          color: "#3b2a22",
        }}
      >
        <div
          style={{
            width: 96,
            height: 96,
            borderRadius: 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(135deg, #c0643c, #b34a4f)",
            color: "#fff8f0",
            fontSize: 60,
            fontWeight: 700,
          }}
        >
          {siteConfig.name.charAt(0)}
        </div>
        <div style={{ fontSize: 84, fontWeight: 700, marginTop: 40, letterSpacing: -2 }}>{siteConfig.name}</div>
        <div style={{ fontSize: 40, marginTop: 12, color: "#8a4b33" }}>{siteConfig.tagline}</div>
        <div style={{ fontSize: 28, marginTop: 40, color: "#6b5348" }}>Order easily on WhatsApp · Delivery across India</div>
      </div>
    ),
    size
  )
}
