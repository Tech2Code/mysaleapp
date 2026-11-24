"use client"

import { BarChart3Icon, TrendingUpIcon } from "lucide-react"
import { useId, useState, type KeyboardEvent } from "react"
import { formatPrice } from "@/lib/format"
import { cn } from "@/lib/utils"

type Point = { label: string; revenue: number; orders: number }
type Metric = "revenue" | "orders"
type ChartMode = "area" | "bars"

const METRICS: { key: Metric; label: string }[] = [
  { key: "revenue", label: "Revenue" },
  { key: "orders", label: "Orders" },
]

/** Round the top of the axis up to a "nice" number so the gridlines read 0, 25%, 50%, 75%, 100%. */
function niceMax(max: number): number {
  if (max <= 0) return 4
  const pow = 10 ** Math.floor(Math.log10(max))
  for (const m of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) {
    if (m * pow >= max) return m * pow
  }
  return 10 * pow
}

/** ₹1.2L, ₹5k … (Indian units) for the axis. */
function compact(n: number, money: boolean): string {
  const p = money ? "₹" : ""
  if (n >= 1e7) return `${p}${+(n / 1e7).toFixed(1)}Cr`
  if (n >= 1e5) return `${p}${+(n / 1e5).toFixed(1)}L`
  if (n >= 1e3) return `${p}${+(n / 1e3).toFixed(1)}k`
  return `${p}${Math.round(n)}`
}

/** Smooth cubic bezier SVG path through data points (Catmull-Rom -> Bezier). */
function smoothPath(pts: readonly { x: number; y: number }[], baselineY: number): { line: string; area: string } {
  if (pts.length === 0) return { line: "", area: "" }
  if (pts.length === 1) {
    const p = pts[0]
    return {
      line: `M${p.x.toFixed(2)},${p.y.toFixed(2)}`,
      area: `M${p.x.toFixed(2)},${baselineY} L${p.x.toFixed(2)},${p.y.toFixed(2)} L${p.x.toFixed(2)},${baselineY} Z`,
    }
  }
  let d = `M${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[Math.min(pts.length - 1, i + 2)]
    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = Math.min(baselineY, Math.max(2, p1.y + (p2.y - p0.y) / 6))
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = Math.min(baselineY, Math.max(2, p2.y - (p3.y - p1.y) / 6))
    d += ` C${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`
  }
  const first = pts[0]
  const last = pts[pts.length - 1]
  return {
    line: d,
    area: `${d} L${last.x.toFixed(2)},${baselineY} L${first.x.toFixed(2)},${baselineY} Z`,
  }
}

/**
 * Modern SaaS Sales Chart: smooth SVG area curve (default) + bar chart toggle,
 * Revenue/Orders switch, summary strip, and interactive hover/touch/keyboard crosshair tooltip.
 */
export function SalesChart({ points, unit, rangeLabel }: { points: Point[]; unit: "day" | "month"; rangeLabel: string }) {
  const gradId = useId()
  const [metric, setMetric] = useState<Metric>("revenue")
  const [chartMode, setChartMode] = useState<ChartMode>("area")
  const [active, setActive] = useState<number | null>(null)
  const money = metric === "revenue"
  const fmt = (n: number) => (money ? formatPrice(n) : `${n} order${n === 1 ? "" : "s"}`)

  const values = points.map((p) => p[metric])
  const total = values.reduce((a, b) => a + b, 0)
  const max = Math.max(0, ...values)
  const best = max > 0 ? values.indexOf(max) : -1
  const average = points.length ? total / points.length : 0
  const top = niceMax(max)
  const ticks = [1, 0.75, 0.5, 0.25, 0]
  const every = Math.max(1, Math.ceil(points.length / 7))
  const shown = active ?? null

  const svgW = 640
  const svgH = 220
  const padY = 10
  const plotH = svgH - padY * 2
  const coords = points.map((p, i) => {
    const x = points.length > 1 ? (i / (points.length - 1)) * svgW : svgW / 2
    const y = padY + plotH - (p[metric] / top) * plotH
    return { x, y }
  })
  const { line, area } = smoothPath(coords, svgH)
  const activePoint = shown !== null ? points[shown] : null
  const activeCoord = shown !== null ? coords[shown] : null

  const onKey = (e: KeyboardEvent) => {
    if (!points.length) return
    if (e.key === "ArrowRight") setActive((i) => Math.min(points.length - 1, (i ?? -1) + 1))
    else if (e.key === "ArrowLeft") setActive((i) => Math.max(0, (i ?? points.length) - 1))
    else if (e.key === "Escape") setActive(null)
    else return
    e.preventDefault()
  }

  return (
    <div data-ui="admin/SalesChart" className="space-y-4">
      {/* summary + switches */}
      <div data-ui="admin/SalesChart/div-flex" className="flex flex-wrap items-start justify-between gap-3">
        <dl data-ui="admin/SalesChart/dl-flex" className="flex flex-wrap gap-x-6 gap-y-2">
          <div data-ui="admin/SalesChart/div">
            <dt data-ui="admin/SalesChart/dt" className="text-[11px] font-medium text-muted-foreground">Total · {rangeLabel}</dt>
            <dd data-ui="admin/SalesChart/dd" className="font-heading text-xl/tight font-semibold tabular-nums sm:text-2xl/tight">{fmt(total)}</dd>
          </div>
          <div data-ui="admin/SalesChart/div-2">
            <dt data-ui="admin/SalesChart/dt-2" className="text-[11px] font-medium text-muted-foreground">Avg / {unit}</dt>
            <dd data-ui="admin/SalesChart/dd-2" className="text-base/tight font-semibold tabular-nums sm:text-lg/tight">{fmt(Math.round(average))}</dd>
          </div>
          {best >= 0 && (
            <div data-ui="admin/SalesChart/div-3">
              <dt data-ui="admin/SalesChart/dt-3" className="text-[11px] font-medium text-muted-foreground">Peak {unit}</dt>
              <dd data-ui="admin/SalesChart/dd-3" className="text-base/tight font-semibold tabular-nums sm:text-lg/tight">
                {fmt(max)} <span data-ui="admin/SalesChart/span" className="text-xs font-normal text-muted-foreground">({points[best].label})</span>
              </dd>
            </div>
          )}
        </dl>

        <div data-ui="admin/SalesChart/div-flex-2" className="flex items-center gap-2">
          <div data-ui="admin/SalesChart/div-chart-style" role="group" aria-label="Chart style" className="inline-flex h-8 items-center rounded-lg border bg-muted/60 p-0.5">
            <button data-ui="admin/SalesChart/button-area-chart"
              type="button"
              onClick={() => setChartMode("area")}
              aria-pressed={chartMode === "area"}
              aria-label="Area chart"
              title="Area chart"
              className={cn(
                "grid size-7 place-items-center rounded-md transition-colors",
                chartMode === "area" ? "bg-card text-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <TrendingUpIcon className="size-3.5" aria-hidden />
            </button>
            <button data-ui="admin/SalesChart/button-bar-chart"
              type="button"
              onClick={() => setChartMode("bars")}
              aria-pressed={chartMode === "bars"}
              aria-label="Bar chart"
              title="Bar chart"
              className={cn(
                "grid size-7 place-items-center rounded-md transition-colors",
                chartMode === "bars" ? "bg-card text-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <BarChart3Icon className="size-3.5" aria-hidden />
            </button>
          </div>

          <div data-ui="admin/SalesChart/div-chart-shows" role="group" aria-label="Chart shows" className="inline-flex h-8 items-center rounded-lg border bg-muted/60 p-0.5">
            {METRICS.map((m) => (
              <button
                data-ui="admin/SalesChart/button"
                key={m.key}
                type="button"
                aria-pressed={metric === m.key}
                onClick={() => setMetric(m.key)}
                className={cn(
                  "h-7 rounded-md px-3 text-xs leading-none font-medium transition-colors",
                  metric === m.key ? "bg-card text-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {total === 0 ? (
        <div data-ui="admin/SalesChart/div-grid" className="grid h-56 place-items-center rounded-xl border border-dashed text-xs text-muted-foreground">
          No {money ? "sales" : "orders"} in this period yet.
        </div>
      ) : (
        <div data-ui="admin/SalesChart/div-flex-3" className="flex gap-2">
          {/* left axis */}
          <div data-ui="admin/SalesChart/div-relative" className="relative h-56 w-11 shrink-0 text-right font-mono text-[10px] text-muted-foreground tabular-nums" aria-hidden>
            {ticks.map((t) => (
              <span data-ui="admin/SalesChart/span-absolute" key={t} className="absolute right-0 -translate-y-1/2 leading-none" style={{ top: `${(1 - t) * 100}%` }}>
                {compact(top * t, money)}
              </span>
            ))}
          </div>

          <div data-ui="admin/SalesChart/div-4" className="min-w-0 flex-1">
            <div
              data-ui="admin/SalesChart/div-relative-2"
              className="relative h-56 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
              tabIndex={0}
              role="application"
              aria-label={`${money ? "Revenue" : "Orders"} by ${unit}. Use the left and right arrow keys to read each ${unit}.`}
              onKeyDown={onKey}
              onBlur={() => setActive(null)}
              onMouseLeave={() => setActive(null)}
            >
              {/* gridlines */}
              {ticks.map((t) => (
                <div
                  data-ui="admin/SalesChart/div-5"
                  key={t}
                  aria-hidden
                  className={cn("absolute inset-x-0 border-t", t === 0 ? "border-border" : "border-dashed border-border/60")}
                  style={{ top: `${(1 - t) * 100}%` }}
                />
              ))}

              {chartMode === "area" ? (
                <>
                  <svg data-ui="admin/SalesChart/svg-absolute" viewBox={`0 0 ${svgW} ${svgH}`} preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible" aria-hidden>
                    <defs>
                      <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.24" />
                        <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.01" />
                      </linearGradient>
                    </defs>
                    <path d={area} fill={`url(#${gradId})`} />
                    <path
                      d={line}
                      fill="none"
                      stroke="var(--primary)"
                      strokeWidth="2.25"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      vectorEffect="non-scaling-stroke"
                      className="adminLineDraw"
                    />
                    {activeCoord && (
                      <line
                        x1={activeCoord.x}
                        y1={0}
                        x2={activeCoord.x}
                        y2={svgH}
                        stroke="var(--primary)"
                        strokeOpacity="0.35"
                        strokeDasharray="3 3"
                        vectorEffect="non-scaling-stroke"
                      />
                    )}
                  </svg>

                  {/* Interactive hit columns + active dot */}
                  <div data-ui="admin/SalesChart/div-flex-4" className="absolute inset-0 flex">
                    {points.map((p, i) => {
                      const isActive = shown === i
                      const dotTopPct = ((padY + plotH - (p[metric] / top) * plotH) / svgH) * 100
                      return (
                        <div data-ui="admin/SalesChart/div-relative-3"
                          key={`${p.label}-${i}`}
                          className="relative flex-1 cursor-crosshair"
                          onMouseEnter={() => setActive(i)}
                          onTouchStart={() => setActive(i)}
                        >
                          {isActive && (
                            <span data-ui="admin/SalesChart/span-absolute-2"
                              className="pointer-events-none absolute left-1/2 size-3 -translate-1/2 rounded-full border-2 border-card bg-primary shadow-sm ring-4 ring-primary/20"
                              style={{ top: `${dotTopPct}%` }}
                              aria-hidden
                            />
                          )}
                        </div>
                      )
                    })}
                  </div>
                </>
              ) : (
                /* Modern rounded gradient bars */
                <div data-ui="admin/SalesChart/div-flex-5" className="absolute inset-0 flex items-end gap-1">
                  {points.map((p, i) => {
                    const v = p[metric]
                    const isActive = shown === i
                    return (
                      <div
                        data-ui="admin/SalesChart/div-flex-6"
                        key={`${p.label}-${i}`}
                        className="group relative flex h-full min-w-0 flex-1 items-end"
                        onMouseEnter={() => setActive(i)}
                        onTouchStart={() => setActive(i)}
                      >
                        <div
                          data-ui="admin/SalesChart/div-6"
                          className={cn(
                            "adminBarGrow w-full rounded-t-md transition-opacity duration-200",
                            v === 0
                              ? "bg-muted-foreground/20"
                              : isActive || (i === best && shown === null)
                                ? "bg-linear-to-b from-primary to-primary/80"
                                : "bg-linear-to-b from-primary/65 to-primary/35",
                            shown !== null && !isActive && "opacity-45"
                          )}
                          style={{
                            height: v === 0 ? "2px" : `max(4px, ${(v / top) * 100}%)`,
                            animationDelay: `${Math.min(i * 18, 280)}ms`,
                          }}
                        />
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Shared floating tooltip */}
              {activePoint && shown !== null && (
                <div
                  data-ui="admin/SalesChart/div-absolute"
                  role="status"
                  className="pointer-events-none absolute z-20 w-max max-w-48 rounded-lg border bg-card/95 px-3 py-2 text-xs text-foreground shadow-md backdrop-blur-xs"
                  style={{
                    bottom: `calc(${Math.min(82, (activePoint[metric] / top) * 100)}% + 12px)`,
                    left: shown < points.length * 0.15 ? "0" : undefined,
                    right: shown > points.length * 0.85 ? "0" : undefined,
                    ...(shown >= points.length * 0.15 && shown <= points.length * 0.85
                      ? { left: `${points.length > 1 ? (shown / (points.length - 1)) * 100 : 50}%`, transform: "translateX(-50%)" }
                      : {}),
                  }}
                >
                  <p data-ui="admin/SalesChart/p" className="text-[11px] font-medium text-muted-foreground">{activePoint.label}</p>
                  <p data-ui="admin/SalesChart/p-2" className="font-mono text-sm font-semibold tabular-nums">{fmt(activePoint[metric])}</p>
                  {metric === "revenue" && activePoint.orders > 0 && (
                    <p data-ui="admin/SalesChart/p-3" className="text-[11px] text-muted-foreground">
                      {activePoint.orders} order{activePoint.orders === 1 ? "" : "s"}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* x labels */}
            <div data-ui="admin/SalesChart/div-flex-7" className="mt-2 flex h-4 gap-1 text-[10px] text-muted-foreground" aria-hidden>
              {points.map((p, i) => (
                <span data-ui="admin/SalesChart/span-relative" key={`${p.label}-${i}`} className="relative min-w-0 flex-1">
                  {i % every === 0 && <span data-ui="admin/SalesChart/span-absolute-3" className="absolute left-0 whitespace-nowrap">{p.label}</span>}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
