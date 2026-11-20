import type { Metadata } from "next"
import { WishlistPageView } from "@/components/store/page-views"
import { getActiveProducts } from "@/features/products/queries"
import { toCardData } from "@/features/products/types"

export const metadata: Metadata = { title: "Wishlist", robots: { index: false } }

export default async function WishlistPage() {
  const products = await getActiveProducts()
  const cards = products.map(toCardData)

  return <WishlistPageView products={cards} />
}
