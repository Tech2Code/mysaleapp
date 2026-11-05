"use client"

import { ScrollLink } from "./scroll-link"
import { useStoreSettings } from "@/components/store/store-settings-provider"
import { cn } from "@/lib/utils"

export function LogoMark({ className }: { className?: string }) {
  const { shopName } = useStoreSettings()
  return (
    <span data-ui="shared/LogoMark"
      aria-hidden
      className={cn(
        "grid size-9 place-items-center rounded-xl bg-linear-to-br from-primary to-[oklch(0.6_0.16_15)] font-heading text-lg font-semibold text-primary-foreground shadow-md shadow-primary/25",
        className
      )}
    >
      {shopName.charAt(0).toUpperCase()}
    </span>
  )
}

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  const { shopName } = useStoreSettings()
  return (
    <ScrollLink data-ui="shared/Logo" href={href} className={cn("group flex items-center gap-2.5", className)} aria-label={`${shopName} home`}>
      <LogoMark className="transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-105" />
      <span data-ui="shared/Logo/span" className="font-heading text-xl font-semibold tracking-tight">{shopName}</span>
    </ScrollLink>
  )
}
