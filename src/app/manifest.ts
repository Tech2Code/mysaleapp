import type { MetadataRoute } from "next"
import { BRAND_ICON_VERSION } from "@/components/shared/brand-glyph"
import { getStoreSettings } from "@/features/settings/queries"
import { resolveThemeBrandPalette } from "@/features/settings/theme"

/** Makes the site installable as an app ("Add to Home screen"). */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const shop = await getStoreSettings()
  const brand = resolveThemeBrandPalette(shop.themePreset, shop.themeCustom)
  const v = `${BRAND_ICON_VERSION}-${brand.versionKey}`
  return {
    name: shop.shopName,
    short_name: shop.shopName.slice(0, 12),
    description: shop.description,
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: brand.backgroundColor,
    theme_color: brand.themeColor,
    categories: ["shopping", "lifestyle"],
    lang: "en-IN",
    icons: [
      { src: `/icons/192?v=${v}`, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: `/icons/512?v=${v}`, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: `/icons/maskable-512?v=${v}`, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Shop all", url: "/products", icons: [{ src: `/icons/192?v=${v}`, sizes: "192x192" }] },
      { name: "My orders", url: "/account/orders", icons: [{ src: `/icons/192?v=${v}`, sizes: "192x192" }] },
      { name: "Track order", url: "/track", icons: [{ src: `/icons/192?v=${v}`, sizes: "192x192" }] },
    ],
  }
}
