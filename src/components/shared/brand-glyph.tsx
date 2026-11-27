/**
 * Single source of truth for the brand symbol & icon palette.
 * Used by LogoMark (header/footer/admin), BrandMark (favicon, Apple icon, PWA icons, OG image),
 * manifest.ts, and viewport themeColor so changing any color or glyph updates the entire app in sync.
 */
export const BRAND_PALETTE = {
  boxColor: "#fffaf4",
  ribbon: "#fbd07c",
  accent: "#9e333b",
  themeColor: "#b85c38",
  backgroundColor: "#fbf7f2",
  gradient: "linear-gradient(140deg, #dc6d38 0%, #c04e3f 48%, #8c2836 100%)",
  borderColor: "rgba(255, 238, 214, 0.32)",
} as const

function hashString(input: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(36)
}

/**
 * The brand symbol: a sculpted boutique gift box with a satin gold ribbon bow, heart knot,
 * and artisan sparkle star. Uses explicit hex colors (never currentColor) so next/og ImageResponse
 * and browser DOM render identically.
 */
export function BrandGlyph({
  size,
  className,
  boxColor = BRAND_PALETTE.boxColor,
  ribbon = BRAND_PALETTE.ribbon,
  accent = BRAND_PALETTE.accent,
}: {
  size: number
  className?: string
  boxColor?: string
  ribbon?: string
  accent?: string
}) {
  return (
    <svg

      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Artisan 4-point sparkle star (top-right) */}
      <path
        d="M39.5 5.5C39.9 8.1 40.9 9.1 43.5 9.5C40.9 9.9 39.9 10.9 39.5 13.5C39.1 10.9 38.1 9.9 35.5 9.5C38.1 9.1 39.1 8.1 39.5 5.5Z"
        fill={ribbon}
      />

      {/* Sculpted twin bow loops */}
      <path
        d="M24 16.5C21.2 10.2 14.2 7.8 10.8 11.2C8.4 13.6 10.5 17.5 16.2 17.5H24V16.5Z"
        fill={ribbon}
      />
      <path
        d="M24 16.5C26.8 10.2 33.8 7.8 37.2 11.2C39.6 13.6 37.5 17.5 31.8 17.5H24V16.5Z"
        fill={ribbon}
      />
      {/* Bow inner cutouts for crisp depth at small favicon sizes */}
      <path
        d="M21.2 15.6C19.3 12.2 15.4 11.1 13.8 12.7C12.7 13.8 14.1 15.8 17.5 15.8H21.2V15.6Z"
        fill={accent}
        fillOpacity="0.65"
      />
      <path
        d="M26.8 15.6C28.7 12.2 32.6 11.1 34.2 12.7C35.3 13.8 33.9 15.8 30.5 15.8H26.8V15.6Z"
        fill={accent}
        fillOpacity="0.65"
      />

      {/* Gift box base (warm ivory) */}
      <rect x="9.5" y="23.5" width="29" height="17.5" rx="4.2" fill={boxColor} fillOpacity="0.95" />

      {/* Subtle shadow band right below the lid */}
      <rect x="9.5" y="23.5" width="29" height="2.8" fill={accent} fillOpacity="0.24" />

      {/* Horizontal satin ribbon across box body */}
      <rect x="9.5" y="30" width="29" height="4.4" fill={ribbon} />

      {/* Gift box overhanging lid */}
      <rect x="7" y="16.8" width="34" height="7.4" rx="3" fill={boxColor} />

      {/* Vertical satin ribbon across lid & box */}
      <rect x="21.4" y="16.8" width="5.2" height="24.2" fill={ribbon} />

      {/* Decorative ribbon tails beneath the knot */}
      <path d="M23.2 18.5L18.2 23.2L20.8 24.4L24 20.2L27.2 24.4L29.8 23.2L24.8 18.5H23.2Z" fill={ribbon} />

      {/* Center jewel knot on lid */}
      <circle cx="24" cy="17.2" r="3.4" fill={boxColor} />
      <circle cx="24" cy="17.2" r="1.9" fill={accent} />
    </svg>
  )
}

/**
 * Auto-derived version token for manifest & PWA icon URLs.
 * Changes automatically whenever BRAND_PALETTE or BrandGlyph SVG geometry/colors change,
 * busting browser, CDN, and Android WebAPK icon caches with zero manual version bumps.
 */
export const BRAND_ICON_VERSION = hashString(`${JSON.stringify(BRAND_PALETTE)}|${BrandGlyph.toString()}`)
