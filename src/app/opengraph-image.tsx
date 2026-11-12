import { ImageResponse } from "next/og"
import { getStoreSettings } from "@/features/settings/queries"
import { BrandMark } from "@/lib/brand-image"

export const alt = "Shop preview"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

/** Default share image (WhatsApp / Instagram / Facebook previews). */
export default async function OpengraphImage() {
  const shop = await getStoreSettings()
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
        <BrandMark size={96} />
        <div style={{ fontSize: 84, fontWeight: 700, marginTop: 40, letterSpacing: -2 }}>{shop.shopName}</div>
        <div style={{ fontSize: 40, marginTop: 12, color: "#8a4b33" }}>{shop.tagline}</div>
        <div style={{ fontSize: 28, marginTop: 40, color: "#6b5348" }}>Pay securely by UPI · Delivery across India</div>
      </div>
    ),
    size
  )
}
