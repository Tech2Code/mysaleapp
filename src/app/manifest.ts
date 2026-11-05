import type { MetadataRoute } from "next"
import { siteConfig } from "@/config/site"

/** Makes the site installable as an app ("Add to Home screen"). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: siteConfig.name,
    short_name: siteConfig.shortName,
    description: siteConfig.description,
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fbf7f2",
    theme_color: "#b85c38",
    categories: ["shopping", "lifestyle"],
    lang: "en-IN",
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Shop all", url: "/products", icons: [{ src: "/icons/192", sizes: "192x192" }] },
      { name: "My orders", url: "/account/orders", icons: [{ src: "/icons/192", sizes: "192x192" }] },
      { name: "Track order", url: "/track", icons: [{ src: "/icons/192", sizes: "192x192" }] },
    ],
  }
}
