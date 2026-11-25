import { useId } from "react"
import { cn } from "@/lib/utils"
import styles from "./admin-core.module.css"

/**
 * Tiny dependency-free SVG charts. They render on the server (no chart library, no client JavaScript),
 * so the dashboard stays fast.
 */

function scale(values: number[], height: number, topPad: number, bottomPad: number) {
  const max = Math.max(...values, 1)
  const min = 0
  const range = max - min || 1
  const usable = height - topPad - bottomPad
  return (v: number) => height - bottomPad - ((Math.max(0, v) - min) / range) * usable
}

function points(values: number[], width: number, height: number, topPad: number, bottomPad: number) {
  const y = scale(values, height, topPad, bottomPad)
  const step = values.length > 1 ? width / (values.length - 1) : width
  return values.map((v, i) => ({ x: i * step, y: y(v) }))
}

/** Monotone cubic Hermite spline so sparklines are smooth without overshooting below 0. */
function monotoneSparkPath(pts: readonly { x: number; y: number }[], baselineY: number) {
  const n = pts.length
  if (n === 0) return ""
  if (n === 1) return `M0,${pts[0].y.toFixed(1)} L${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`

  const dx: number[] = []
  const m: number[] = []
  for (let i = 0; i < n - 1; i++) {
    const dxi = pts[i + 1].x - pts[i].x
    const dyi = pts[i + 1].y - pts[i].y
    dx.push(dxi)
    m.push(dxi !== 0 ? dyi / dxi : 0)
  }

  const t: number[] = new Array(n).fill(0)
  t[0] = m[0]
  t[n - 1] = m[n - 2]
  for (let i = 1; i < n - 1; i++) {
    t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2
  }
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) {
      t[i] = 0
      t[i + 1] = 0
    } else {
      const a = t[i] / m[i]
      const b = t[i + 1] / m[i]
      const h = Math.hypot(a, b)
      if (h > 3) {
        const s = 3 / h
        t[i] = s * a * m[i]
        t[i + 1] = s * b * m[i]
      }
    }
  }

  let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[i]
    const p1 = pts[i + 1]
    const step = dx[i] / 3
    const cp1x = p0.x + step
    const cp1y = Math.min(baselineY, Math.max(1, p0.y + t[i] * step))
    const cp2x = p1.x - step
    const cp2y = Math.min(baselineY, Math.max(1, p1.y - t[i + 1] * step))
    d += ` C${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p1.x.toFixed(1)},${p1.y.toFixed(1)}`
  }
  return d
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
  const series = data.length >= 2 ? data : data.length === 1 ? [data[0], data[0]] : [0, 0]
  const pts = points(series, w, h, 4, 2)
  const line = monotoneSparkPath(pts, h - 2)
  const area = `${line} L${w},${h} L0,${h} Z`

  return (
    <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label} className={cn(styles.sparklineSvg, className)} preserveAspectRatio="none">
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
