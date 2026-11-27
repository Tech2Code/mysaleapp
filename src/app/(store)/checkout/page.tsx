import type { Metadata } from "next"
import { CheckoutPageView } from "@/components/store/page-views"
import { getMyProfile } from "@/features/account/actions"
import { listMyAddresses } from "@/features/addresses/actions"
import { getCurrentUser } from "@/features/auth/guards"
import { getActiveProducts } from "@/features/products/queries"

export const metadata: Metadata = { title: "Checkout", robots: { index: false } }

export default async function CheckoutPage() {
  const [products, initialAddresses, initialProfile, user] = await Promise.all([
    getActiveProducts(),
    listMyAddresses(),
    getMyProfile(),
    getCurrentUser(),
  ])
  const live = products.map(({ id, price, stock, name, images, slug, weightGrams, shippingClass, variants }) => ({
    id,
    price,
    stock,
    name,
    images,
    slug,
    weightGrams,
    shippingClass,
    variants,
  }))

  return (
    <CheckoutPageView
      products={live}
      initialAddresses={initialAddresses}
      initialProfile={initialProfile}
      initialUserId={user?.id ?? null}
    />
  )
}
