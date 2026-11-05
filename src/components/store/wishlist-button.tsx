"use client"

import { HeartIcon } from "lucide-react"
import { motion } from "motion/react"
import { useWishlistToggle } from "@/hooks/use-wishlist-toggle"
import { cn } from "@/lib/utils"

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
    <motion.button data-ui="store/WishlistButton"
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
        "grid place-items-center rounded-full border bg-background/85 shadow-sm backdrop-blur transition-colors hover:bg-background",
        size === "md" ? "size-9" : "size-11",
        className
      )}
    >
      <motion.span data-ui="store/WishlistButton/m-span"
        key={active ? "on" : "off"}
        initial={{ scale: 0.6 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 500, damping: 15 }}
      >
        <HeartIcon
          className={cn(
            size === "md" ? "size-4" : "size-5",
            active ? "fill-rose-500 text-rose-500" : "text-foreground/70"
          )}
        />
      </motion.span>
    </motion.button>
  )
}
