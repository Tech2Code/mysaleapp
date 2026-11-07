import type { Metadata } from "next"
import { CartPageView } from "@/components/store/page-views"
import { getActiveProducts } from "@/features/products/queries"

export const metadata: Metadata = { title: "Your cart", robots: { index: false } }

export default async function CartPage() {
  const products = await getActiveProducts()
  const live = products.map(({ id, price, stock, name, images, slug, fees }) => ({ id, price, stock, name, images, slug, fees }))

  return <CartPageView products={live} />
}
