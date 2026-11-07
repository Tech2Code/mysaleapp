"use client"

import Image from "next/image"
import { useState } from "react"
import { cn } from "@/lib/utils"

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
  // Remember WHICH src failed, so a changed src (gallery thumbnail) starts fresh without an effect.
  const [failedSrc, setFailedSrc] = useState<string | null>(null)

  if (src && failedSrc !== src) {
    return (
      <Image data-ui="store/ProductImage"
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        onError={() => setFailedSrc(src)}
        className={cn("object-cover text-transparent", className)}
      />
    )
  }

  const hue = hueFrom(alt)
  return (
    <div data-ui="store/ProductImage"
      role="img"
      aria-label={alt}
      className={cn("absolute inset-0 grid place-items-center overflow-hidden", className)}
      style={{
        background: `radial-gradient(80% 80% at 20% 15%, oklch(0.93 0.06 ${hue}), transparent 60%),
                     radial-gradient(70% 70% at 85% 90%, oklch(0.88 0.08 ${(hue + 40) % 360}), transparent 60%),
                     oklch(0.95 0.03 ${(hue + 20) % 360})`,
      }}
    >
      <span data-ui="store/ProductImage/span"
        aria-hidden
        className="font-heading text-[min(28cqw,6rem)] font-semibold opacity-30 select-none"
        style={{ color: `oklch(0.45 0.1 ${hue})` }}
      >
        {alt.charAt(0)}
      </span>
    </div>
  )
}
