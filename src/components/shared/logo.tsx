"use client"

import { BRAND_PALETTE, BrandGlyph } from "./brand-glyph"
import { ScrollLink } from "./scroll-link"
import { useStoreSettings } from "@/components/store/store-settings-provider"
import { cn } from "@/lib/utils"
import styles from "./shared.module.css"

export function LogoMark({ className }: { className?: string }) {
  return (
    <span

      aria-hidden
      className={cn(
        styles.logoMarkBox,
        className
      )}
    >
      <span className={styles.logoSheen} />
      <BrandGlyph
        size={24}
        boxColor={BRAND_PALETTE.boxColor}
        ribbon={BRAND_PALETTE.ribbon}
        accent={BRAND_PALETTE.accent}
        className={styles.glyphRelative}
      />
    </span>
  )
}

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  const { shopName } = useStoreSettings()
  return (
    <ScrollLink href={href} className={cn(styles.logoLink, className)} aria-label={`${shopName} home`}>
      <LogoMark className={styles.logoMarkHover} />
      <span className={styles.shopNameText}>{shopName}</span>
    </ScrollLink>
  )
}
