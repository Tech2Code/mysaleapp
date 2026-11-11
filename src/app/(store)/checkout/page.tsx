import type { Metadata } from "next"
import { CheckoutPageView } from "@/components/store/page-views"
import { getMyProfile } from "@/features/account/actions"
import { listMyAddresses } from "@/features/addresses/actions"
import { getActiveProducts } from "@/features/products/queries"

export const metadata: Metadata = { title: "Checkout", robots: { index: false } }

export default async function CheckoutPage() {
  const [products, initialAddresses, initialProfile] = await Promise.all([
    getActiveProducts(),
    listMyAddresses(),
    getMyProfile(),
  ])
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

  return <CheckoutPageView products={live} initialAddresses={initialAddresses} initialProfile={initialProfile} />
}
