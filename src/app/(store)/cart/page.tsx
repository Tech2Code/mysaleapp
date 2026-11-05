import type { Metadata } from "next"
import { CartView } from "@/components/store/cart-view"
import { PageHeader } from "@/components/store/page-header"
import { getActiveProducts } from "@/features/products/queries"

export const metadata: Metadata = { title: "Your cart", robots: { index: false } }

export default async function CartPage() {
  const products = await getActiveProducts()
  const live = products.map(({ id, price, stock, name, images, slug, fees }) => ({ id, price, stock, name, images, slug, fees }))

  return (
    <>
      <PageHeader title="Your cart" breadcrumbs={[{ name: "Home", href: "/" }, { name: "Cart" }]} />
      <div className="container-page pt-8">
        <CartView products={live} />
      </div>
    </>
  )
}
