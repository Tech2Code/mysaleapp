import type { Metadata } from "next"
import { siteConfig } from "@/config/site"
import type { Category, Product } from "@/features/products/types"

export const absoluteUrl = (path = "/") => `${siteConfig.url}${path.startsWith("/") ? path : `/${path}`}`

/** Consistent per-page metadata with canonical URL + OpenGraph + Twitter. */
export function pageMetadata(input: {
  title: string
  description: string
  path: string
  images?: string[]
  noIndex?: boolean
}): Metadata {
  const url = absoluteUrl(input.path)
  return {
    title: input.title,
    description: input.description,
    alternates: { canonical: url },
    openGraph: {
      title: input.title,
      description: input.description,
      url,
      siteName: siteConfig.name,
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

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteConfig.name,
    url: siteConfig.url,
    logo: absoluteUrl("/icons/512"),
    sameAs: Object.values(siteConfig.socials).filter(Boolean),
    contactPoint: {
      "@type": "ContactPoint",
      telephone: siteConfig.contact.phone,
      contactType: "customer service",
      areaServed: "IN",
      availableLanguage: ["English", "Hindi"],
    },
  }
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteConfig.name,
    url: siteConfig.url,
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${siteConfig.url}/products?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  }
}

export function productJsonLd(product: Product) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.seoDescription || product.description,
    sku: product.id,
    url: absoluteUrl(`/products/${product.slug}`),
    image: product.images.length ? product.images : [absoluteUrl("/opengraph-image")],
    brand: { "@type": "Brand", name: siteConfig.name },
    ...(product.category ? { category: product.category.name } : {}),
    offers: {
      "@type": "Offer",
      url: absoluteUrl(`/products/${product.slug}`),
      priceCurrency: siteConfig.currency,
      price: product.price.toFixed(2),
      availability: product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@type": "Organization", name: siteConfig.name },
      shippingDetails: {
        "@type": "OfferShippingDetails",
        shippingDestination: { "@type": "DefinedRegion", addressCountry: "IN" },
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

export function itemListJsonLd(products: Product[], category?: Category) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: category ? category.name : `${siteConfig.name} products`,
    itemListElement: products.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: absoluteUrl(`/products/${p.slug}`),
      name: p.name,
    })),
  }
}
