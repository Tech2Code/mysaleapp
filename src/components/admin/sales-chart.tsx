"use client"

import { BarChart3Icon, TrendingUpIcon } from "lucide-react"
import { useId, useState, type KeyboardEvent } from "react"
import { formatPrice } from "@/lib/format"
import { SegmentedTabs } from "@/components/shared/segmented-tabs"
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

/**
 * Monotone cubic Hermite spline (Fritsch–Carlson) SVG path through data points.
 * Preserves monotonicity between consecutive points so flat zero stretches stay
 * strictly flat on the baseline and steep peaks never overshoot or dip below zero.
 */
function smoothPath(pts: readonly { x: number; y: number }[], baselineY: number): { line: string; area: string } {
  const n = pts.length
  if (n === 0) return { line: "", area: "" }
  if (n === 1) {
    const p = pts[0]
    return {
      line: `M${p.x.toFixed(2)},${p.y.toFixed(2)}`,
      area: `M${p.x.toFixed(2)},${baselineY} L${p.x.toFixed(2)},${p.y.toFixed(2)} L${p.x.toFixed(2)},${baselineY} Z`,
    }
  }

  const dx: number[] = []
  const dy: number[] = []
  const m: number[] = []
  for (let i = 0; i < n - 1; i++) {
    const dxi = pts[i + 1].x - pts[i].x
    const dyi = pts[i + 1].y - pts[i].y
    dx.push(dxi)
    dy.push(dyi)
    m.push(dxi !== 0 ? dyi / dxi : 0)
  }

  const tangents: number[] = new Array(n).fill(0)
  tangents[0] = m[0]
  tangents[n - 1] = m[n - 2]
  for (let i = 1; i < n - 1; i++) {
    if (m[i - 1] * m[i] <= 0) {
      tangents[i] = 0
    } else {
      tangents[i] = (m[i - 1] + m[i]) / 2
    }
  }

  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) {
      tangents[i] = 0
      tangents[i + 1] = 0
    } else {
      const a = tangents[i] / m[i]
      const b = tangents[i + 1] / m[i]
      const h = Math.hypot(a, b)
      if (h > 3) {
        const scale = 3 / h
        tangents[i] = scale * a * m[i]
        tangents[i + 1] = scale * b * m[i]
      }
    }
  }

  let d = `M${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)}`
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[i]
    const p1 = pts[i + 1]
    const step = dx[i] / 3
    const cp1x = p0.x + step
    const cp1y = Math.min(baselineY, Math.max(0, p0.y + tangents[i] * step))
    const cp2x = p1.x - step
    const cp2y = Math.min(baselineY, Math.max(0, p1.y - tangents[i + 1] * step))
    d += ` C${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p1.x.toFixed(2)},${p1.y.toFixed(2)}`
  }

  const first = pts[0]
  const last = pts[n - 1]
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
  const svgH = 224
  const coords = points.map((p, i) => {
    const xPct = points.length > 1 ? (i / (points.length - 1)) * 100 : 50
    const yPct = 100 - (p[metric] / top) * 100
    return {
      x: (xPct / 100) * svgW,
      y: (yPct / 100) * svgH,
      xPct,
      yPct,
    }
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
            <dd className={styles.metricSubDd}>
              {!money && average > 0 && average < 1 ? `${average.toFixed(1)} orders` : fmt(Math.round(average))}
            </dd>
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
          <SegmentedTabs
            layout="inline"
            size="sm"
            ariaLabel="Chart style"
            value={chartMode}
            onChange={setChartMode}
            items={[
              { value: "area", icon: TrendingUpIcon, ariaLabel: "Area chart", title: "Area chart" },
              { value: "bars", icon: BarChart3Icon, ariaLabel: "Bar chart", title: "Bar chart" },
            ]}
          />

          <SegmentedTabs
            layout="inline"
            size="sm"
            ariaLabel="Chart shows"
            value={metric}
            onChange={setMetric}
            items={METRICS.map((m) => ({ value: m.key, label: m.label }))}
          />
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
                      key={`${metric}-${points.length}`}
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

                  {activeCoord && (
                    <span
                      className={styles.activeDot}
                      style={{ left: `${activeCoord.xPct}%`, top: `${activeCoord.yPct}%` }}
                      aria-hidden
                    />
                  )}

                  {/* Interactive hit columns centered around each data point */}
                  <div className={styles.hitColumnsRow}>
                    {points.map((p, i) => {
                      const weight = points.length > 1 && (i === 0 || i === points.length - 1) ? 0.5 : 1
                      return (
                        <div
                          key={`${p.label}-${i}`}
                          className={styles.hitCol}
                          style={{ flexGrow: weight }}
                          onMouseEnter={() => setActive(i)}
                          onTouchStart={() => setActive(i)}
                        />
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
            {chartMode === "area" ? (
              <div className={styles.xAxisAreaRow} aria-hidden>
                {points.map((p, i) => {
                  if (i % every !== 0) return null
                  const xPct = points.length > 1 ? (i / (points.length - 1)) * 100 : 50
                  const align = i === 0 ? "0%" : xPct >= 92 ? "-100%" : "-50%"
                  return (
                    <span
                      key={`${p.label}-${i}`}
                      className={styles.xAxisAreaLabel}
                      style={{ left: `${xPct}%`, transform: `translateX(${align})` }}
                    >
                      {p.label}
                    </span>
                  )
                })}
              </div>
            ) : (
              <div className={styles.xAxisRow} aria-hidden>
                {points.map((p, i) => (
                  <span key={`${p.label}-${i}`} className={styles.xAxisCell}>
                    {i % every === 0 && <span className={styles.xAxisLabel}>{p.label}</span>}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
