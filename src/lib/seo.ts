import type { Metadata } from "next"
import { siteConfig } from "@/config/site"
import type { Category, Product } from "@/features/products/types"
import type { StoreSettings } from "@/features/settings/types"

export const absoluteUrl = (path = "/") => `${siteConfig.url}${path.startsWith("/") ? path : `/${path}`}`

/**
 * Consistent per-page metadata with canonical URL + OpenGraph + Twitter.
 * `shop` is the owner's settings (getStoreSettings()), so the site name always matches Admin → Settings.
 */
export function pageMetadata(
  shop: Pick<StoreSettings, "shopName">,
  input: {
    title: string
    description: string
    path: string
    images?: string[]
    noIndex?: boolean
  }
): Metadata {
  const url = absoluteUrl(input.path)
  return {
    title: input.title,
    description: input.description,
    alternates: { canonical: url },
    openGraph: {
      title: input.title,
      description: input.description,
      url,
      siteName: shop.shopName,
      locale: siteConfig.locale,
      type: "website",
      ...(input.images?.length ? { images: input.images.map((src) => ({ url: src })) } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: input.title,
      description: input.description,
      ...(input.images?.length ? { images: input.images } : {}),
    },
    ...(input.noIndex ? { robots: { index: false, follow: false } } : {}),
  }
}

export function organizationJsonLd(s: StoreSettings) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: s.shopName,
    url: siteConfig.url,
    logo: absoluteUrl("/icons/512"),
    sameAs: [s.instagramUrl, s.facebookUrl].filter((u): u is string => Boolean(u)),
    ...(s.phone
      ? {
          contactPoint: {
            "@type": "ContactPoint",
            telephone: s.phone,
            contactType: "customer service",
            areaServed: siteConfig.country,
            availableLanguage: ["English", "Hindi"],
          },
        }
      : {}),
  }
}

export function websiteJsonLd(s: Pick<StoreSettings, "shopName">) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: s.shopName,
    url: siteConfig.url,
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${siteConfig.url}/products?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  }
}

export function productJsonLd(product: Product, s: Pick<StoreSettings, "shopName">) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.seoDescription || product.description,
    sku: product.id,
    url: absoluteUrl(`/products/${product.slug}`),
    image: product.images.length ? product.images : [absoluteUrl("/opengraph-image")],
    brand: { "@type": "Brand", name: s.shopName },
    ...(product.category ? { category: product.category.name } : {}),
    offers: {
      "@type": "Offer",
      url: absoluteUrl(`/products/${product.slug}`),
      priceCurrency: siteConfig.currency,
      price: product.price.toFixed(2),
      availability: product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@type": "Organization", name: s.shopName },
      shippingDetails: {
        "@type": "OfferShippingDetails",
        shippingDestination: { "@type": "DefinedRegion", addressCountry: siteConfig.country },
      },
    },
  }
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  }
}

export function itemListJsonLd(products: Product[], shop: Pick<StoreSettings, "shopName">, category?: Category) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: category ? category.name : `${shop.shopName} products`,
    itemListElement: products.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: absoluteUrl(`/products/${p.slug}`),
      name: p.name,
    })),
  }
}
