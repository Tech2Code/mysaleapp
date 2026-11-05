import type { Metadata } from "next"
import { PageHeader } from "@/components/store/page-header"
import { WishlistView } from "@/components/store/wishlist-view"
import { getActiveProducts } from "@/features/products/queries"

export const metadata: Metadata = { title: "Wishlist", robots: { index: false } }

export default async function WishlistPage() {
  const products = await getActiveProducts()
  const cards = products.map(({ id, slug, name, price, compareAtPrice, images, stock, category }) => ({
    id,
    slug,
    name,
    price,
    compareAtPrice,
    images,
    stock,
    category,
  }))

  return (
    <>
      <PageHeader title="Your wishlist" breadcrumbs={[{ name: "Home", href: "/" }, { name: "Wishlist" }]} />
      <div data-ui="page:/wishlist/div" className="container-page pt-4 sm:pt-6">
        <WishlistView products={cards} />
      </div>
    </>
  )
}
