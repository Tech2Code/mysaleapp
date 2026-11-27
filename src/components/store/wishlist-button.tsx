"use client"

import { HeartIcon } from "lucide-react"
import * as m from "motion/react-m"
import { useEffect, useRef, useState } from "react"
import { useWishlistToggle } from "@/hooks/use-wishlist-toggle"
import { cn } from "@/lib/utils"
import { triggerFlyWishlist } from "@/store/cart"
import styles from "./product-card.module.css"

export function WishlistButton({
  productId,
  productName,
  productImage,
  className,
  size = "md",
}: {
  productId: string
  productName: string
  productImage?: string | null
  className?: string
  size?: "md" | "lg"
}) {
  const { active, toggle, pending } = useWishlistToggle(productId, productName)
  const [showBurst, setShowBurst] = useState(false)
  const [popCount, setPopCount] = useState(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return (
    <m.button
      type="button"
      whileTap={{ scale: 0.82 }}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        if (pending) return
        const mode = active ? "remove" : "add"
        triggerFlyWishlist(e.currentTarget, mode, productImage)
        if (!active) {
          setPopCount((c) => c + 1)
          setShowBurst(true)
          if (timerRef.current) clearTimeout(timerRef.current)
          timerRef.current = setTimeout(() => setShowBurst(false), 620)
        } else {
          setShowBurst(false)
        }
        toggle()
      }}
      aria-pressed={active}
      aria-label={active ? `Remove ${productName} from wishlist` : `Add ${productName} to wishlist`}
      className={cn(
        styles.wishlistTrigger,
        size === "md" ? styles.wishlistSizeMd : styles.wishlistSizeLg,
        active && styles.wishlistTriggerActive,
        className
      )}
    >
      {showBurst && (
        <span key={`burst-${popCount}`} className={styles.heartBurstLayer} aria-hidden="true">
          <span className={styles.heartBurstRing} />
          <span className={cn(styles.heartSparkleDot, styles.heartSparkle1)} />
          <span className={cn(styles.heartSparkleDot, styles.heartSparkle2)} />
          <span className={cn(styles.heartSparkleDot, styles.heartSparkle3)} />
          <span className={cn(styles.heartSparkleDot, styles.heartSparkle4)} />
          <span className={cn(styles.heartSparkleDot, styles.heartSparkle5)} />
          <span className={cn(styles.heartSparkleDot, styles.heartSparkle6)} />
        </span>
      )}
      <m.span
        key={active ? `on-${popCount}` : "off"}
        initial={popCount > 0 && active ? { scale: 0.55, rotate: -14 } : false}
        animate={popCount > 0 && active ? { scale: [0.55, 1.38, 0.9, 1.12, 1], rotate: [-14, 10, -4, 0] } : { scale: 1, rotate: 0 }}
        transition={popCount > 0 && active ? { duration: 0.46, ease: [0.22, 1, 0.36, 1] } : { type: "spring", stiffness: 520, damping: 24 }}
        className={styles.heartMotionWrap}
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
