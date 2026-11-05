import Link from "next/link"
import { siteConfig } from "@/config/site"
import { cn } from "@/lib/utils"

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-9 place-items-center rounded-xl bg-gradient-to-br from-primary to-[oklch(0.6_0.16_15)] font-heading text-lg font-semibold text-primary-foreground shadow-md shadow-primary/25",
        className
      )}
    >
      {siteConfig.name.charAt(0)}
    </span>
  )
}

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn("group flex items-center gap-2.5", className)} aria-label={`${siteConfig.name} home`}>
      <LogoMark className="transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-105" />
      <span className="font-heading text-xl font-semibold tracking-tight">{siteConfig.name}</span>
    </Link>
  )
}
