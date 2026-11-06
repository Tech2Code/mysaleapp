import { useId } from "react"
import { cn } from "@/lib/utils"

/**
 * Tiny dependency-free SVG charts. They render on the server (no chart library, no client JavaScript),
 * so the dashboard stays fast.
 */

function scale(values: number[], height: number, pad: number) {
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const range = max - min || 1
  return (v: number) => height - pad - ((v - min) / range) * (height - pad * 2)
}

function points(values: number[], width: number, height: number, pad: number) {
  const y = scale(values, height, pad)
  const step = values.length > 1 ? width / (values.length - 1) : width
  return values.map((v, i) => [i * step, y(v)] as const)
}

/** Smooth-ish line through the points. */
function linePath(pts: readonly (readonly [number, number])[]) {
  return pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ")
}

export function Sparkline({
  data,
  className,
  label,
}: {
  data: number[]
  className?: string
  /** Accessible summary, e.g. "Revenue over the last 30 days". */
  label: string
}) {
  const id = useId()
  const w = 120
  const h = 36
  const pts = points(data.length ? data : [0, 0], w, h, 3)
  const line = linePath(pts)
  const area = `${line} L${w},${h} L0,${h} Z`

  return (
    <svg data-ui="admin/Sparkline" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label} className={cn("h-9 w-full text-primary", className)} preserveAspectRatio="none">
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}
