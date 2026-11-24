"use client"

import Image from "next/image"
import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import styles from "./product-card.module.css"

function hueFrom(text: string): number {
  let h = 0
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) % 360
  return h
}

/**
 * Optimised product photo (AVIF/WebP via next/image). Falls back to a soft,
 * on-brand gradient tile until the admin uploads a real photo, or if the photo fails to load.
 * `text-transparent` hides the alt text while the photo downloads (the parent's muted background shows).
 */
export function ProductImage({
  src,
  alt,
  sizes,
  priority,
  className,
}: {
  src: string | null | undefined
  alt: string
  sizes: string
  priority?: boolean
  className?: string
}) {
  // Remember WHICH src failed/loaded, so a changed src (gallery thumbnail) starts fresh without an effect.
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null)
  const mounted = useRef(false)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  // Inline `data:` URIs come from skeleton placeholders (`placeholderProduct`); render the lightweight CSS tile instead of mounting/preloading next/image.
  if (src && !src.startsWith("data:") && failedSrc !== src) {
    const isLoaded = Boolean(priority) || loadedSrc === src
    return (
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        decoding="async"
        onLoad={() => {
          if (mounted.current) setLoadedSrc(src)
        }}
        onError={() => {
          if (mounted.current) setFailedSrc(src)
        }}
        className={cn(
          styles.productImg,
          isLoaded ? styles.productImgLoaded : styles.productImgPending,
          className
        )}
      />
    )
  }

  const hue = hueFrom(alt)
  return (
    <div
      role="img"
      aria-label={alt}
      className={cn(styles.fallbackTile, className)}
      style={{
        background: `radial-gradient(80% 80% at 20% 15%, oklch(0.93 0.06 ${hue}), transparent 60%),
                     radial-gradient(70% 70% at 85% 90%, oklch(0.88 0.08 ${(hue + 40) % 360}), transparent 60%),
                     oklch(0.95 0.03 ${(hue + 20) % 360})`,
      }}
    >
      <span
        aria-hidden
        className={styles.fallbackLetter}
        style={{ color: `oklch(0.45 0.1 ${hue})` }}
      >
        {alt.charAt(0)}
      </span>
    </div>
  )
}
