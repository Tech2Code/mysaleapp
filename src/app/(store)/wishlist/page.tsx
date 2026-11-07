import type { Metadata } from "next"
import { WishlistPageView } from "@/components/store/page-views"
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

  return <WishlistPageView products={cards} />
}
