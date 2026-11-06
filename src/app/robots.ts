import type { MetadataRoute } from "next"
import { absoluteUrl } from "@/lib/seo"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Private or thin pages that shouldn't appear in search results
        disallow: ["/admin", "/account", "/cart", "/checkout", "/order-placed", "/wishlist", "/login", "/auth", "/api", "/offline"],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: absoluteUrl("/"),
  }
}
