import type { Metadata } from "next"
import { CheckoutForm } from "@/components/store/checkout-form"
import { PageHeader } from "@/components/store/page-header"
import { getActiveProducts } from "@/features/products/queries"

export const metadata: Metadata = { title: "Checkout", robots: { index: false } }

export default async function CheckoutPage() {
  const products = await getActiveProducts()
  const live = products.map(({ id, price, stock, name, images, slug }) => ({ id, price, stock, name, images, slug }))

  return (
    <>
      <PageHeader
        title="Checkout"
        description="Fill in your details — your order opens in WhatsApp, ready to send."
        breadcrumbs={[{ name: "Home", href: "/" }, { name: "Cart", href: "/cart" }, { name: "Checkout" }]}
      />
      <div className="container-page pt-8">
        <CheckoutForm products={live} />
      </div>
    </>
  )
}
