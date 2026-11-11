import type { Metadata } from "next"
import { CartPageView } from "@/components/store/page-views"
import { getActiveProducts } from "@/features/products/queries"

export const metadata: Metadata = { title: "Your cart", robots: { index: false } }

export default async function CartPage() {
  const products = await getActiveProducts()
  const live = products.map(({ id, price, stock, name, images, slug, weightGrams, shippingClass }) => ({
    id,
    price,
    stock,
    name,
    images,
    slug,
    weightGrams,
    shippingClass,
  }))

  return <CartPageView products={live} />
}
