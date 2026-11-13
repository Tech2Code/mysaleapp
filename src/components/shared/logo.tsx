"use client"

import { BrandGlyph } from "./brand-glyph"
import { ScrollLink } from "./scroll-link"
import { useStoreSettings } from "@/components/store/store-settings-provider"
import { cn } from "@/lib/utils"

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      data-ui="shared/LogoMark"
      aria-hidden
      className={cn(
        "relative grid size-9.5 place-items-center overflow-hidden rounded-xl bg-linear-to-br from-[#d96b38] via-primary to-[#8e2936] font-heading text-lg font-semibold text-[#fffaf4] shadow-md shadow-primary/30 ring-1 ring-inset ring-white/25",
        className
      )}
    >
      <span data-ui="shared/LogoMark/span-absolute" className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-linear-to-b from-white/15 to-transparent" />
      <BrandGlyph size={24} ribbon="#fbd07c" accent="#9e333b" className="relative drop-shadow-xs" />
    </span>
  )
}

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  const { shopName } = useStoreSettings()
  return (
    <ScrollLink data-ui="shared/Logo" href={href} className={cn("group flex min-w-0 items-center gap-2.5", className)} aria-label={`${shopName} home`}>
      <LogoMark className="shrink-0 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-105" />
      <span data-ui="shared/Logo/span" className="truncate font-heading text-xl font-semibold tracking-tight">{shopName}</span>
    </ScrollLink>
  )
}
