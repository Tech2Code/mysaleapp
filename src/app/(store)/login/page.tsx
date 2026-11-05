import { HeartIcon, MapPinIcon, PackageIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { LogoMark } from "@/components/shared/logo"
import { GoogleSignIn } from "@/components/store/google-sign-in"
import { getStoreSettings } from "@/features/settings/queries"

export const metadata: Metadata = { title: "Sign in", robots: { index: false } }

const perks = [
  { icon: PackageIcon, text: "Track all your orders in one place" },
  { icon: HeartIcon, text: "Keep your wishlist on every device" },
  { icon: MapPinIcon, text: "Save your address for faster checkout" },
]

export default async function LoginPage() {
  const shop = await getStoreSettings()
  return (
    <section data-ui="page:/login" className="bg-hero">
      <div data-ui="page:/login/div-flex" className="container-page flex min-h-[70vh] items-center justify-center py-12 sm:py-16">
        <div data-ui="page:/login/div" className="w-full max-w-md rounded-4xl border bg-card/80 p-8 shadow-2xl shadow-black/5 backdrop-blur sm:p-10">
          <LogoMark className="size-12 text-2xl" />
          <h1 data-ui="page:/login/h1-welcome-to" className="mt-6 text-3xl font-semibold">Welcome to {shop.shopName}</h1>
          <p data-ui="page:/login/p" className="mt-2 text-muted-foreground">Sign in with one tap — no password to remember.</p>

          <ul data-ui="page:/login/ul" className="my-8 space-y-3">
            {perks.map((p) => (
              <li data-ui="page:/login/li-flex" key={p.text} className="flex items-center gap-3 text-sm">
                <span data-ui="page:/login/span-grid" className="grid size-8 place-items-center rounded-full bg-secondary text-primary">
                  <p.icon data-ui="page:/login/p.icon" className="size-4" />
                </span>
                {p.text}
              </li>
            ))}
          </ul>

          <Suspense>
            <GoogleSignIn />
          </Suspense>

          <p data-ui="page:/login/p-2" className="mt-6 text-center text-xs text-muted-foreground">
            Signing in is optional — you can also{" "}
            <Link data-ui="page:/login/Link-order-as-a-guest" href="/products" className="font-medium text-primary underline-offset-4 hover:underline">
              order as a guest
            </Link>
            .
          </p>
        </div>
      </div>
    </section>
  )
}
