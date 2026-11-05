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

export function AreaChart({
  data,
  labels,
  label,
  formatValue,
  className,
}: {
  data: number[]
  /** One label per point (e.g. dates). First, middle and last are shown under the chart. */
  labels: string[]
  label: string
  formatValue: (n: number) => string
  className?: string
}) {
  const id = useId()
  const w = 640
  const h = 200
  const pts = points(data.length ? data : [0, 0], w, h, 14)
  const line = linePath(pts)
  const area = `${line} L${w},${h} L0,${h} Z`
  const max = Math.max(...data, 0)
  const mid = Math.floor((labels.length - 1) / 2)
  const best = data.length ? data.indexOf(max) : -1
  const bestPoint = best >= 0 && max > 0 ? pts[best] : null
  const xPct = bestPoint ? (bestPoint[0] / w) * 100 : 50

  return (
    <div data-ui="admin/AreaChart" className={className}>
      <div data-ui="admin/AreaChart/div-relative" className="relative">
        <svg data-ui="admin/AreaChart/svg" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label} className="h-48 w-full text-primary sm:h-56" preserveAspectRatio="none">
          <defs>
            <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.32" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75].map((f) => (
            <line key={f} x1="0" x2={w} y1={h * f} y2={h * f} stroke="currentColor" strokeOpacity="0.1" strokeDasharray="4 6" vectorEffect="non-scaling-stroke" />
          ))}
          <path d={area} fill={`url(#${id})`} />
          <path d={line} fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
        {bestPoint && (
          <span data-ui="admin/AreaChart/span-absolute"
            className="pointer-events-none absolute rounded-md bg-foreground px-2 py-1 text-[0.7rem] font-semibold whitespace-nowrap text-background shadow"
            style={{
              left: `${xPct}%`,
              top: `${(bestPoint[1] / h) * 100}%`,
              // keep the tag inside the chart: shift it left/right near the edges, below the point near the top
              transform: `translate(${xPct < 18 ? "-12%" : xPct > 82 ? "-88%" : "-50%"}, ${bestPoint[1] / h < 0.2 ? "0.5rem" : "-100%"})`,
            }}
          >
            Best day · {formatValue(max)}
          </span>
        )}
      </div>
      <div data-ui="admin/AreaChart/div-flex" className="mt-2 flex justify-between text-xs text-muted-foreground" aria-hidden>
        <span data-ui="admin/AreaChart/span">{labels[0]}</span>
        <span data-ui="admin/AreaChart/span-2">{labels[mid]}</span>
        <span data-ui="admin/AreaChart/span-3">{labels.at(-1)}</span>
      </div>
    </div>
  )
}
