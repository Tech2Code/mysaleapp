import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export default function NotFound() {
  return (
    <main data-ui="not-found:/" className="grid min-h-dvh place-items-center bg-hero px-4 text-center">
      <div data-ui="not-found://div">
        <p data-ui="not-found://p" className="font-heading text-8xl font-semibold text-gradient">404</p>
        <h1 data-ui="not-found://h1-this-page-wandered-off" className="mt-4 text-3xl font-semibold">This page wandered off</h1>
        <p data-ui="not-found://p-2" className="mt-2 text-muted-foreground">The page you&apos;re looking for doesn&apos;t exist or was moved.</p>
        <div data-ui="not-found://div-flex" className="mt-8 flex justify-center gap-3">
          <Link data-ui="not-found://Link-go-home" href="/" className={cn(buttonVariants({ size: "lg" }), "rounded-full px-6")}>
            Go home
          </Link>
          <Link data-ui="not-found://Link-shop-all" href="/products" className={cn(buttonVariants({ size: "lg", variant: "outline" }), "rounded-full px-6")}>
            Shop all
          </Link>
        </div>
      </div>
    </main>
  )
}
