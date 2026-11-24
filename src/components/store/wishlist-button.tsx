"use client"

import { HeartIcon } from "lucide-react"
import * as m from "motion/react-m"
import { useWishlistToggle } from "@/hooks/use-wishlist-toggle"
import { cn } from "@/lib/utils"
import styles from "./product-card.module.css"

export function WishlistButton({
  productId,
  productName,
  className,
  size = "md",
}: {
  productId: string
  productName: string
  className?: string
  size?: "md" | "lg"
}) {
  const { active, toggle } = useWishlistToggle(productId, productName)

  return (
    <m.button
      type="button"
      whileTap={{ scale: 0.85 }}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        toggle()
      }}
      aria-pressed={active}
      aria-label={active ? `Remove ${productName} from wishlist` : `Add ${productName} to wishlist`}
      className={cn(
        styles.wishlistTrigger,
        size === "md" ? styles.wishlistSizeMd : styles.wishlistSizeLg,
        className
      )}
    >
      <m.span
        key={active ? "on" : "off"}
        initial={{ scale: 0.6 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 500, damping: 15 }}
      >
        <HeartIcon
          className={cn(
            size === "md" ? styles.heartIconMd : styles.heartIconLg,
            active ? styles.heartActive : styles.heartInactive
          )}
        />
      </m.span>
    </m.button>
  )
}
