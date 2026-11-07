import type { Metadata } from "next"
import { CheckoutPageView } from "@/components/store/page-views"
import { getActiveProducts } from "@/features/products/queries"

export const metadata: Metadata = { title: "Checkout", robots: { index: false } }

export default async function CheckoutPage() {
  const products = await getActiveProducts()
  const live = products.map(({ id, price, stock, name, images, slug, fees }) => ({ id, price, stock, name, images, slug, fees }))

  return <CheckoutPageView products={live} />
}
