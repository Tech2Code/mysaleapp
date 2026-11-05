import type { Metadata } from "next"
import { CheckoutForm } from "@/components/store/checkout-form"
import { PageHeader } from "@/components/store/page-header"
import { getActiveProducts } from "@/features/products/queries"

export const metadata: Metadata = { title: "Checkout", robots: { index: false } }

export default async function CheckoutPage() {
  const products = await getActiveProducts()
  const live = products.map(({ id, price, stock, name, images, slug, fees }) => ({ id, price, stock, name, images, slug, fees }))

  return (
    <>
      <PageHeader
        title="Checkout"
        description="Enter your delivery details, then pay by UPI to confirm your order."
        breadcrumbs={[{ name: "Home", href: "/" }, { name: "Cart", href: "/cart" }, { name: "Checkout" }]}
      />
      <div data-ui="page:/checkout/div" className="container-page pt-4 sm:pt-6">
        <CheckoutForm products={live} />
      </div>
    </>
  )
}
