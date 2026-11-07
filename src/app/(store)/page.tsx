import { JsonLd } from "@/components/shared/json-ld"
import { HomeView } from "@/components/store/home-view"
import { getActiveProducts, getCategoriesWithCounts, getFeaturedProducts } from "@/features/products/queries"
import { getStoreSettings } from "@/features/settings/queries"
import { websiteJsonLd } from "@/lib/seo"

export default async function HomePage() {
  const [featured, all, categories, shop] = await Promise.all([
    getFeaturedProducts(8),
    getActiveProducts(),
    getCategoriesWithCounts(),
    getStoreSettings(),
  ])

  return (
    <>
      <HomeView featured={featured} all={all} categories={categories} shop={shop} />
      <JsonLd data={websiteJsonLd(shop)} />
    </>
  )
}
