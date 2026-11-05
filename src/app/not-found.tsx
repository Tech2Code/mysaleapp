import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-hero px-4 text-center">
      <div>
        <p className="font-heading text-8xl font-semibold text-gradient">404</p>
        <h1 className="mt-4 text-3xl font-semibold">This page wandered off</h1>
        <p className="mt-2 text-muted-foreground">The page you&apos;re looking for doesn&apos;t exist or was moved.</p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/" className={cn(buttonVariants({ size: "lg" }), "rounded-full px-6")}>
            Go home
          </Link>
          <Link href="/products" className={cn(buttonVariants({ size: "lg", variant: "outline" }), "rounded-full px-6")}>
            Shop all
          </Link>
        </div>
      </div>
    </main>
  )
}
