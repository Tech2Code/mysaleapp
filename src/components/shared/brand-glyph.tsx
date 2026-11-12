/**
 * The brand symbol: a sculpted boutique gift box with a satin gold ribbon bow, heart knot,
 * and artisan sparkle star. It does not depend on the shop name (owner-editable), so the
 * header logo, PWA icons, Apple touch icon, and favicon stay consistent.
 * Uses pure SVG primitives compatible with next/og ImageResponse.
 */
export function BrandGlyph({
  size,
  className,
  ribbon = "#f7c873",
  accent = "#b84349",
}: {
  size: number
  className?: string
  ribbon?: string
  accent?: string
}) {
  return (
    <svg
      data-ui="shared/BrandGlyph"
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
      <rect x="9.5" y="23.5" width="29" height="17.5" rx="4.2" fill="currentColor" fillOpacity="0.95" />

      {/* Subtle shadow band right below the lid */}
      <rect x="9.5" y="23.5" width="29" height="2.8" fill={accent} fillOpacity="0.24" />

      {/* Horizontal satin ribbon across box body */}
      <rect x="9.5" y="30" width="29" height="4.4" fill={ribbon} />

      {/* Gift box overhanging lid */}
      <rect x="7" y="16.8" width="34" height="7.4" rx="3" fill="currentColor" />

      {/* Vertical satin ribbon across lid & box */}
      <rect x="21.4" y="16.8" width="5.2" height="24.2" fill={ribbon} />

      {/* Decorative ribbon tails beneath the knot */}
      <path d="M23.2 18.5L18.2 23.2L20.8 24.4L24 20.2L27.2 24.4L29.8 23.2L24.8 18.5H23.2Z" fill={ribbon} />

      {/* Center jewel knot on lid */}
      <circle cx="24" cy="17.2" r="3.4" fill="currentColor" />
      <circle cx="24" cy="17.2" r="1.9" fill={accent} />
    </svg>
  )
}
