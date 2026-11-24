"use client"

import { BarChart3Icon, TrendingUpIcon } from "lucide-react"
import { useId, useState, type KeyboardEvent } from "react"
import { formatPrice } from "@/lib/format"
import { cn } from "@/lib/utils"
import styles from "./admin-core.module.css"

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
    <div className={styles.salesChartWrap}>
      {/* summary + switches */}
      <div className={styles.chartHeaderRow}>
        <dl className={styles.chartSummaryDl}>
          <div>
            <dt className={styles.metricDt}>Total · {rangeLabel}</dt>
            <dd className={styles.metricTotalDd}>{fmt(total)}</dd>
          </div>
          <div>
            <dt className={styles.metricDt}>Avg / {unit}</dt>
            <dd className={styles.metricSubDd}>{fmt(Math.round(average))}</dd>
          </div>
          {best >= 0 && (
            <div>
              <dt className={styles.metricDt}>Peak {unit}</dt>
              <dd className={styles.metricSubDd}>
                {fmt(max)} <span className={styles.peakLabelSpan}>({points[best].label})</span>
              </dd>
            </div>
          )}
        </dl>

        <div className={styles.chartControlsRow}>
          <div role="group" aria-label="Chart style" className={styles.segmentedGroup}>
            <button
              type="button"
              onClick={() => setChartMode("area")}
              aria-pressed={chartMode === "area"}
              aria-label="Area chart"
              title="Area chart"
              className={cn(
                styles.modeIconBtn,
                chartMode === "area" && styles.segBtnActive
              )}
            >
              <TrendingUpIcon className={styles.icon14} aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => setChartMode("bars")}
              aria-pressed={chartMode === "bars"}
              aria-label="Bar chart"
              title="Bar chart"
              className={cn(
                styles.modeIconBtn,
                chartMode === "bars" && styles.segBtnActive
              )}
            >
              <BarChart3Icon className={styles.icon14} aria-hidden />
            </button>
          </div>

          <div role="group" aria-label="Chart shows" className={styles.segmentedGroup}>
            {METRICS.map((m) => (
              <button

                key={m.key}
                type="button"
                aria-pressed={metric === m.key}
                onClick={() => setMetric(m.key)}
                className={cn(
                  styles.metricTabBtn,
                  metric === m.key && styles.segBtnActive
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {total === 0 ? (
        <div className={styles.emptyChartBox}>
          No {money ? "sales" : "orders"} in this period yet.
        </div>
      ) : (
        <div className={styles.chartPlotFlex}>
          {/* left axis */}
          <div className={styles.yAxisCol} aria-hidden>
            {ticks.map((t) => (
              <span key={t} className={styles.yAxisTick} style={{ top: `${(1 - t) * 100}%` }}>
                {compact(top * t, money)}
              </span>
            ))}
          </div>

          <div className={styles.plotMainCol}>
            <div

              className={styles.plotCanvas}
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

                  key={t}
                  aria-hidden
                  className={cn(styles.gridLine, t === 0 ? styles.gridLineBase : styles.gridLineDashed)}
                  style={{ top: `${(1 - t) * 100}%` }}
                />
              ))}

              {chartMode === "area" ? (
                <>
                  <svg viewBox={`0 0 ${svgW} ${svgH}`} preserveAspectRatio="none" className={styles.areaSvg} aria-hidden>
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
                  <div className={styles.hitColumnsRow}>
                    {points.map((p, i) => {
                      const isActive = shown === i
                      const dotTopPct = ((padY + plotH - (p[metric] / top) * plotH) / svgH) * 100
                      return (
                        <div
                          key={`${p.label}-${i}`}
                          className={styles.hitCol}
                          onMouseEnter={() => setActive(i)}
                          onTouchStart={() => setActive(i)}
                        >
                          {isActive && (
                            <span
                              className={styles.activeDot}
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
                <div className={styles.barsRow}>
                  {points.map((p, i) => {
                    const v = p[metric]
                    const isActive = shown === i
                    return (
                      <div

                        key={`${p.label}-${i}`}
                        className={styles.barSlot}
                        onMouseEnter={() => setActive(i)}
                        onTouchStart={() => setActive(i)}
                      >
                        <div

                          className={cn(
                            "adminBarGrow",
                            styles.barFill,
                            v === 0
                              ? styles.barZero
                              : isActive || (i === best && shown === null)
                                ? styles.barPeak
                                : styles.barNormal,
                            shown !== null && !isActive && styles.barDimmed
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

                  role="status"
                  className={styles.chartTooltip}
                  style={{
                    bottom: `calc(${Math.min(82, (activePoint[metric] / top) * 100)}% + 12px)`,
                    left: shown < points.length * 0.15 ? "0" : undefined,
                    right: shown > points.length * 0.85 ? "0" : undefined,
                    ...(shown >= points.length * 0.15 && shown <= points.length * 0.85
                      ? { left: `${points.length > 1 ? (shown / (points.length - 1)) * 100 : 50}%`, transform: "translateX(-50%)" }
                      : {}),
                  }}
                >
                  <p className={styles.tooltipLabel}>{activePoint.label}</p>
                  <p className={styles.tooltipValue}>{fmt(activePoint[metric])}</p>
                  {metric === "revenue" && activePoint.orders > 0 && (
                    <p className={styles.tooltipSub}>
                      {activePoint.orders} order{activePoint.orders === 1 ? "" : "s"}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* x labels */}
            <div className={styles.xAxisRow} aria-hidden>
              {points.map((p, i) => (
                <span key={`${p.label}-${i}`} className={styles.xAxisCell}>
                  {i % every === 0 && <span className={styles.xAxisLabel}>{p.label}</span>}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
