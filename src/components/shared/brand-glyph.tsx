/**
 * The brand symbol: a handmade gift box with a ribbon bow. It does not depend on the
 * shop name (owner-editable), so the logo and every icon stay consistent.
 * Plain SVG with no hooks, so it also renders inside next/og ImageResponse.
 */
export function BrandGlyph({ size, className, ribbon = "#f3c6a3" }: { size: number; className?: string; ribbon?: string }) {
  return (
    <svg data-ui="shared/BrandGlyph"
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* bow loops */}
      <path d="M24 17C20 7 9.5 8.5 11.5 15c1.5 4.8 8.5 3.8 12.5 2Z" fill="currentColor" />
      <path d="M24 17c4-10 14.5-8.5 12.5-2-1.5 4.8-8.5 3.8-12.5 2Z" fill="currentColor" />
      {/* lid + box */}
      <rect x="8.5" y="17" width="31" height="7.5" rx="2.2" fill="currentColor" />
      <rect x="11" y="26" width="26" height="14" rx="2.6" fill="currentColor" fillOpacity=".92" />
      {/* ribbon + knot */}
      <rect x="21.5" y="17" width="5" height="23" fill={ribbon} />
      <circle cx="24" cy="17" r="3.2" fill={ribbon} />
    </svg>
  )
}
