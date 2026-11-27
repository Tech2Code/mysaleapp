import type { MetadataRoute } from "next"
import { BRAND_PALETTE } from "@/components/shared/brand-glyph"
import { getStoreSettings } from "@/features/settings/queries"

/** Makes the site installable as an app ("Add to Home screen"). */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const shop = await getStoreSettings()
  return {
    name: shop.shopName,
    short_name: shop.shopName.slice(0, 12),
    description: shop.description,
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: BRAND_PALETTE.backgroundColor,
    theme_color: BRAND_PALETTE.themeColor,
    categories: ["shopping", "lifestyle"],
    lang: "en-IN",
    icons: [
      { src: "/icons/192?v=2", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/512?v=2", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512?v=2", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Shop all", url: "/products", icons: [{ src: "/icons/192?v=2", sizes: "192x192" }] },
      { name: "My orders", url: "/account/orders", icons: [{ src: "/icons/192?v=2", sizes: "192x192" }] },
      { name: "Track order", url: "/track", icons: [{ src: "/icons/192?v=2", sizes: "192x192" }] },
    ],
  }
}
