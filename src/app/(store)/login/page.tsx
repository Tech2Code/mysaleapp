import { HeartIcon, MapPinIcon, PackageIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { LogoMark } from "@/components/shared/logo"
import { GoogleSignIn } from "@/components/store/google-sign-in"
import { siteConfig } from "@/config/site"

export const metadata: Metadata = { title: "Sign in", robots: { index: false } }

const perks = [
  { icon: PackageIcon, text: "Track all your orders in one place" },
  { icon: HeartIcon, text: "Keep your wishlist on every device" },
  { icon: MapPinIcon, text: "Save your address for faster checkout" },
]

export default function LoginPage() {
  return (
    <section className="bg-hero">
      <div className="container-page flex min-h-[70vh] items-center justify-center py-16">
        <div className="w-full max-w-md rounded-[2rem] border bg-card/80 p-8 shadow-2xl shadow-black/5 backdrop-blur sm:p-10">
          <LogoMark className="size-12 text-2xl" />
          <h1 className="mt-6 text-3xl font-semibold">Welcome to {siteConfig.name}</h1>
          <p className="mt-2 text-muted-foreground">Sign in with one tap — no password to remember.</p>

          <ul className="my-8 space-y-3">
            {perks.map((p) => (
              <li key={p.text} className="flex items-center gap-3 text-sm">
                <span className="grid size-8 place-items-center rounded-full bg-secondary text-primary">
                  <p.icon className="size-4" />
                </span>
                {p.text}
              </li>
            ))}
          </ul>

          <Suspense>
            <GoogleSignIn />
          </Suspense>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Signing in is optional — you can also{" "}
            <Link href="/products" className="font-medium text-primary underline-offset-4 hover:underline">
              order as a guest
            </Link>
            .
          </p>
        </div>
      </div>
    </section>
  )
}
