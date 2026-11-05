import { ImageResponse } from "next/og"
import { siteConfig } from "@/config/site"
import { getProductBySlug } from "@/features/products/queries"
import { formatPrice } from "@/lib/format"

export const alt = "Product preview"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

/** Rich share card for each product: photo, name and price. */
export default async function ProductOgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const product = await getProductBySlug(slug)
  const name = product?.name ?? siteConfig.name
  const photo = product?.images[0]

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "linear-gradient(135deg, #fbf3e9 0%, #f6dcd2 100%)",
          color: "#3b2a22",
        }}
      >
        <div style={{ width: 560, height: 630, display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element -- ImageResponse needs a plain <img>
            <img src={photo} alt="" width={480} height={550} style={{ objectFit: "cover", borderRadius: 32 }} />
          ) : (
            <div
              style={{
                width: 480,
                height: 550,
                borderRadius: 32,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "linear-gradient(135deg, #f0c9b4, #e8b4b8)",
                fontSize: 220,
                fontWeight: 700,
                color: "#ffffff",
              }}
            >
              {name.charAt(0)}
            </div>
          )}
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", paddingRight: 70 }}>
          <div style={{ fontSize: 28, color: "#8a4b33", fontWeight: 600 }}>{siteConfig.name}</div>
          <div style={{ fontSize: 60, fontWeight: 700, lineHeight: 1.1, marginTop: 16 }}>{name}</div>
          {product && (
            <div style={{ fontSize: 52, fontWeight: 700, marginTop: 28, color: "#b85c38" }}>{formatPrice(product.price)}</div>
          )}
          <div style={{ fontSize: 26, marginTop: 28, color: "#6b5348" }}>Handmade · Order on WhatsApp</div>
        </div>
      </div>
    ),
    size
  )
}
