"use client"

import { useState, type KeyboardEvent } from "react"
import { formatPrice } from "@/lib/format"
import { cn } from "@/lib/utils"

type Point = { label: string; revenue: number; orders: number }
type Metric = "revenue" | "orders"

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
 * Sales bar chart you can actually read: a switch for Revenue / Orders, a summary (total, average, best),
 * values on the left axis, and a tooltip with the exact number when you hover, touch, or use ← → keys.
 */
export function SalesChart({ points, unit, rangeLabel }: { points: Point[]; unit: "day" | "month"; rangeLabel: string }) {
  const [metric, setMetric] = useState<Metric>("revenue")
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
  const every = Math.max(1, Math.ceil(points.length / 7)) // about 7 labels under the bars
  const shown = active ?? null
  const avgPct = (average / top) * 100

  const onKey = (e: KeyboardEvent) => {
    if (!points.length) return
    if (e.key === "ArrowRight") setActive((i) => Math.min(points.length - 1, (i ?? -1) + 1))
    else if (e.key === "ArrowLeft") setActive((i) => Math.max(0, (i ?? points.length) - 1))
    else if (e.key === "Escape") setActive(null)
    else return
    e.preventDefault()
  }

  return (
    <div data-ui="admin/SalesChart" className="space-y-5">
      {/* summary + switch */}
      <div data-ui="admin/SalesChart/div-flex" className="flex flex-wrap items-start justify-between gap-4">
        <dl data-ui="admin/SalesChart/dl-flex" className="flex flex-wrap gap-x-8 gap-y-3">
          <div data-ui="admin/SalesChart/div">
            <dt data-ui="admin/SalesChart/dt" className="text-xs text-muted-foreground">Total · {rangeLabel}</dt>
            <dd data-ui="admin/SalesChart/dd" className="font-heading text-2xl/tight  font-semibold tabular-nums">{fmt(total)}</dd>
          </div>
          <div data-ui="admin/SalesChart/div-2">
            <dt data-ui="admin/SalesChart/dt-2" className="text-xs text-muted-foreground">Average per {unit}</dt>
            <dd data-ui="admin/SalesChart/dd-2" className="text-lg/tight  font-semibold tabular-nums">{fmt(Math.round(average))}</dd>
          </div>
          {best >= 0 && (
            <div data-ui="admin/SalesChart/div-3">
              <dt data-ui="admin/SalesChart/dt-3" className="text-xs text-muted-foreground">Best {unit}</dt>
              <dd data-ui="admin/SalesChart/dd-3" className="text-lg/tight  font-semibold tabular-nums">
                {fmt(max)} <span data-ui="admin/SalesChart/span" className="text-sm font-normal text-muted-foreground">on {points[best].label}</span>
              </dd>
            </div>
          )}
        </dl>
        <div data-ui="admin/SalesChart/div-group" role="group" aria-label="Chart shows" className="inline-flex h-9 items-center rounded-full bg-muted p-1">
          {METRICS.map((m) => (
            <button
              data-ui="admin/SalesChart/button"
              key={m.key}
              type="button"
              aria-pressed={metric === m.key}
              onClick={() => setMetric(m.key)}
              className={cn(
                "h-7 rounded-full px-3.5 text-sm leading-none font-medium transition-colors",
                metric === m.key ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {total === 0 ? (
        <div data-ui="admin/SalesChart/div-grid" className="grid h-56 place-items-center rounded-xl border border-dashed text-sm text-muted-foreground">
          No {money ? "sales" : "orders"} in this period yet.
        </div>
      ) : (
        <div data-ui="admin/SalesChart/div-flex-2" className="flex gap-2">
          {/* left axis */}
          <div data-ui="admin/SalesChart/div-flex-3" className="relative h-56 w-11 shrink-0 text-right text-[11px] text-muted-foreground tabular-nums" aria-hidden>
            {ticks.map((t) => (
              <span data-ui="admin/SalesChart/span-2" key={t} className="absolute right-0 -translate-y-1/2 leading-none" style={{ top: `${(1 - t) * 100}%` }}>
                {compact(top * t, money)}
              </span>
            ))}
          </div>

          <div data-ui="admin/SalesChart/div-2" className="min-w-0 flex-1">
            <div
              data-ui="admin/SalesChart/div-application"
              className="relative h-56 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
              tabIndex={0}
              role="application"
              aria-label={`${money ? "Revenue" : "Orders"} by ${unit}. Use the left and right arrow keys to read each ${unit}.`}
              onKeyDown={onKey}
              onBlur={() => setActive(null)}
              onMouseLeave={() => setActive(null)}
            >
              {/* gridlines */}
              {ticks.map((t) => (
                <div data-ui="admin/SalesChart/div-3" key={t} aria-hidden className={cn("absolute inset-x-0 border-t", t === 0 ? "border-border" : "border-dashed border-border/70")} style={{ top: `${(1 - t) * 100}%` }} />
              ))}
              {/* average line */}
              {average > 0 && (
                <div data-ui="admin/SalesChart/div-4" aria-hidden className="pointer-events-none absolute inset-x-0 border-t border-dashed border-primary/60" style={{ bottom: `${avgPct}%` }}>
                  <span data-ui="admin/SalesChart/span-3" className="absolute right-0 -translate-y-full rounded-sm bg-card/80 px-1 text-[10px] font-medium text-primary">avg</span>
                </div>
              )}
              {/* bars */}
              <div data-ui="admin/SalesChart/div-flex-4" className="absolute inset-0 flex items-end gap-[3px]">
                {points.map((p, i) => {
                  const v = p[metric]
                  const isActive = shown === i
                  return (
                    <div
                      data-ui="admin/SalesChart/div-5"
                      key={`${p.label}-${i}`}
                      className="group relative flex h-full min-w-0 flex-1 items-end"
                      onMouseEnter={() => setActive(i)}
                      onTouchStart={() => setActive(i)}
                    >
                      <div
                        data-ui="admin/SalesChart/div-6"
                        className={cn(
                          "w-full rounded-t-[3px] transition-[background-color,opacity,height] duration-300",
                          v === 0 ? "bg-muted-foreground/25" : isActive ? "bg-primary" : i === best && shown === null ? "bg-primary" : "bg-primary/55",
                          shown !== null && !isActive && "opacity-60"
                        )}
                        style={{ height: v === 0 ? "2px" : `max(3px, ${(v / top) * 100}%)` }}
                      />
                      {isActive && (
                        <div
                          data-ui="admin/SalesChart/div-status"
                          role="status"
                          className="pointer-events-none absolute z-10 w-max max-w-44 rounded-lg bg-foreground px-3 py-2 text-xs text-background shadow-lg"
                          style={{
                            bottom: `calc(${(v / top) * 100}% + 8px)`,
                            left: i < points.length * 0.15 ? "0" : undefined,
                            right: i > points.length * 0.85 ? "0" : undefined,
                            ...(i >= points.length * 0.15 && i <= points.length * 0.85 ? { left: "50%", transform: "translateX(-50%)" } : {}),
                          }}
                        >
                          <p data-ui="admin/SalesChart/p" className="opacity-70">{p.label}</p>
                          <p data-ui="admin/SalesChart/p-2" className="text-sm font-semibold tabular-nums">{fmt(v)}</p>
                          {metric === "revenue" && p.orders > 0 && <p data-ui="admin/SalesChart/p-3" className="opacity-70">{p.orders} order{p.orders === 1 ? "" : "s"}</p>}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
            {/* x labels */}
            <div data-ui="admin/SalesChart/div-flex-5" className="mt-2 flex h-4 gap-[3px] text-[11px] text-muted-foreground" aria-hidden>
              {points.map((p, i) => (
                <span data-ui="admin/SalesChart/span-4" key={`${p.label}-${i}`} className="relative min-w-0 flex-1">
                  {i % every === 0 && <span data-ui="admin/SalesChart/span-5" className="absolute left-0 whitespace-nowrap">{p.label}</span>}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
