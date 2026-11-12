"use client"

import { RotateCcwIcon, SlidersHorizontalIcon } from "lucide-react"
import { LIMITS } from "@/lib/validation"
import { useRouter } from "next/navigation"
import { useDeferredValue, useEffect, useOptimistic, useRef, useState, useTransition, type ReactNode } from "react"
import { OrdersTable } from "@/components/admin/orders-table"
import { SearchField, SelectField, type SelectOption } from "@/components/form"
import { Skeletonize } from "@/components/shared/skeletonize"
import { fyYearOf, orderMonthOptions, orderYearOptions, resolveOrderPeriod } from "@/features/orders/dashboard-range"
import { PLACEHOLDER_TODAY, placeholderOrders } from "@/features/orders/placeholders"
import type { OrderFilterCounts, ReturnViewCounts } from "@/features/orders/admin-queries"
import type { CustomerOrderStatusCounts } from "@/features/orders/queries"
import { isOrderView, ORDER_VIEWS, RETURN_VIEWS } from "@/features/orders/views"
import { ORDER_STATUSES, STATUS_META } from "@/features/orders/types"
import { cn } from "@/lib/utils"

/** Placeholder rows shown while the list reloads. */
const ORDERS_SKELETON_ROWS = 20

type Filters = { status?: string; payment?: string; view?: string; q?: string; year?: string; month?: string; today?: string }

/**
 * Filters + results for the admin orders list.
 * - Dropdowns & quick queues switch instantly (optimistic), so the next filter can be chosen straight away; the last pick wins.
 * - While the server list reloads, a skeleton replaces it (no top progress bar: that is for page changes).
 * - `children` is the server-rendered list.
 */
export function OrdersBrowser({
  children,
  returnCounts,
  filterCounts,
  ...current
}: Filters & { children: ReactNode; returnCounts?: ReturnViewCounts; filterCounts?: OrderFilterCounts }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [applied, setApplied] = useOptimistic<Filters, Filters>(current, (state, next) => ({ ...state, ...next }))
  const [query, setQuery] = useState(current.q ?? "")
  const [prevServerQ, setPrevServerQ] = useState(current.q ?? "")
  const [mobileOpen, setMobileOpen] = useState(false)
  if ((current.q ?? "") !== prevServerQ) {
    setPrevServerQ(current.q ?? "")
    setQuery(current.q ?? "")
  }
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const today = current.today ?? PLACEHOLDER_TODAY
  const currentFy = String(fyYearOf(today))
  const currentYm = today.slice(0, 7)
  const period = resolveOrderPeriod({ year: applied.year, month: applied.month }, today)
  const yearOptions = orderYearOptions(today, period.year)
  const monthOptions = orderMonthOptions(today, period.year)

  const go = (next: Filters) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    const merged: Filters = { ...applied, ...next }
    // picking a status/payment/date filter leaves any dashboard "view"; picking a view replaces status/payment
    if (next.status !== undefined || next.payment !== undefined || next.year !== undefined || next.month !== undefined) {
      merged.view = undefined
    }
    if (next.view !== undefined) {
      merged.status = undefined
      merged.payment = undefined
    }
    const resolved = resolveOrderPeriod({ year: merged.year, month: merged.month }, today)
    const sp = new URLSearchParams()
    if (merged.view && isOrderView(merged.view)) sp.set("view", merged.view)
    if (merged.status && merged.status !== "all") sp.set("status", merged.status)
    if (merged.payment && merged.payment !== "all") sp.set("payment", merged.payment)
    if (merged.q?.trim()) sp.set("q", merged.q.trim())
    if (resolved.year !== currentFy || resolved.month !== currentYm) {
      sp.set("year", resolved.year)
      if (resolved.year !== "all") sp.set("month", resolved.month)
    }
    startTransition(() => {
      setApplied({ ...merged, year: resolved.year, month: resolved.month })
      router.push(`/admin/orders${sp.size ? `?${sp}` : ""}`)
    })
  }
  const goRef = useRef(go)
  useEffect(() => {
    goRef.current = go
  })

  // Search as you type: wait for a short pause (and at least 2 characters, or empty to clear), then update the list.
  useEffect(() => {
    const typed = query.trim()
    if (typed === (applied.q ?? "").trim()) return
    if (typed.length > 0 && typed.length < 2) return
    const timer = setTimeout(() => {
      timerRef.current = null
      goRef.current({ q: typed })
    }, 350)
    timerRef.current = timer
    return () => {
      clearTimeout(timer)
      timerRef.current = null
    }
  }, [query, applied.q])

  const view = isOrderView(applied.view) ? applied.view : null
  const status = view === "to-ship" ? "to-ship" : view ? "all" : (applied.status ?? "all")
  const payment =
    view === "to-verify"
      ? "submitted"
      : view === "awaiting-payment"
        ? "failed"
        : view
          ? "all"
          : (applied.payment ?? "all")
  const returnView = view && (RETURN_VIEWS as readonly string[]).includes(view) ? view : "none"

  const sc = filterCounts?.status
  const activeOrderCount = sc ? sc.pending + sc.confirmed + sc.packed : 0
  const toShipCount = sc ? sc.confirmed + sc.packed : undefined
  const statusOptions: SelectOption[] = [
    {
      value: "all",
      label: "All",
      badge: activeOrderCount > 0 ? String(activeOrderCount) : undefined,
      tone: activeOrderCount > 0 ? "attention" : "default",
    },
    {
      value: "to-ship",
      label: "Ready to ship",
      badge: toShipCount !== undefined ? String(toShipCount) : undefined,
      tone: (toShipCount ?? 0) > 0 ? "attention" : "default",
    },
    ...ORDER_STATUSES.map((s): SelectOption => {
      const c = sc?.[s]
      const isActionable = (s === "pending" || s === "confirmed" || s === "packed") && (c ?? 0) > 0
      return {
        value: s,
        label: STATUS_META[s].label,
        badge: c !== undefined ? String(c) : undefined,
        tone: isActionable ? "attention" : "default",
      }
    }),
  ]

  const pc = filterCounts?.payment
  const paymentAttentionCount = pc ? pc.submitted + pc.failed + pc["refund-due"] : 0
  const paymentOptions: SelectOption[] = [
    {
      value: "all",
      label: "Any",
      badge: paymentAttentionCount > 0 ? String(paymentAttentionCount) : undefined,
      tone: paymentAttentionCount > 0 ? "attention" : "default",
    },
    { value: "submitted", label: "To verify", badge: pc ? String(pc.submitted) : undefined, tone: (pc?.submitted ?? 0) > 0 ? "attention" : "default" },
    { value: "failed", label: "Rejected", badge: pc ? String(pc.failed) : undefined, tone: (pc?.failed ?? 0) > 0 ? "attention" : "default" },
    { value: "paid", label: "Paid", badge: pc ? String(pc.paid) : undefined },
    { value: "refund-due", label: "Refund due", badge: pc ? String(pc["refund-due"]) : undefined, tone: (pc?.["refund-due"] ?? 0) > 0 ? "attention" : "default" },
    { value: "refunded", label: "Refunded", badge: pc ? String(pc.refunded) : undefined },
  ]

  const rc = filterCounts?.returns ?? returnCounts
  const returnAttentionCount = rc ? rc["return-requests"] + rc["returns-to-receive"] + rc["return-refund-pending"] : 0
  const returnOptions: SelectOption[] = [
    {
      value: "none",
      label: "All",
      badge: returnAttentionCount > 0 ? String(returnAttentionCount) : undefined,
      tone: returnAttentionCount > 0 ? "attention" : "default",
    },
    ...RETURN_VIEWS.map((v): SelectOption => {
      const count = rc?.[v]
      const needsAction = v !== "returns-refunded" && (count ?? 0) > 0
      return {
        value: v,
        label: ORDER_VIEWS[v].label,
        badge: count !== undefined ? String(count) : undefined,
        tone: needsAction ? "attention" : "default",
      }
    }),
  ]

  const activeCategoryFilterCount =
    (status !== "all" ? 1 : 0) +
    (payment !== "all" ? 1 : 0) +
    (returnView !== "none" ? 1 : 0)

  const hasActiveFilters =
    activeCategoryFilterCount > 0 ||
    Boolean(applied.q?.trim()) ||
    period.year !== currentFy ||
    period.month !== currentYm

  return (
    <div data-ui="admin/OrdersBrowser">
      <div data-ui="admin/OrdersBrowser/div" className="mb-4 space-y-2.5 rounded-2xl border bg-card p-3 sm:p-4">
        {/* Row 1: Search + Mobile Filter Toggle + Financial Year & Month */}
        <div data-ui="admin/OrdersBrowser/div-flex" className="flex flex-wrap items-center gap-2">
          <form
            data-ui="admin/OrdersBrowser/form"
            onSubmit={(e) => {
              e.preventDefault()
              go({ q: query })
            }}
            className="min-w-0 flex-1"
            role="search"
          >
            <SearchField
              label="Search orders"
              maxLength={LIMITS.orderSearch.max}
              fieldSize="md"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onClear={() => {
                setQuery("")
                go({ q: "" })
              }}
              placeholder="Search code, phone or name…"
            />
          </form>

          {/* Mobile-only filter toggle for Status / Payment / Returns */}
          <button
            data-ui="admin/OrdersBrowser/button"
            type="button"
            aria-expanded={mobileOpen || activeCategoryFilterCount > 0}
            onClick={() => setMobileOpen((v) => !v)}
            className={cn(
              "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors sm:hidden",
              activeCategoryFilterCount > 0 || mobileOpen
                ? "border-primary/60 bg-primary/10 text-primary"
                : "bg-background text-foreground hover:bg-muted"
            )}
          >
            <SlidersHorizontalIcon className="size-3.5" aria-hidden />
            <span data-ui="admin/OrdersBrowser/span">Filters</span>
            {activeCategoryFilterCount > 0 && (
              <span data-ui="admin/OrdersBrowser/span-2" className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground tabular-nums">
                {activeCategoryFilterCount}
              </span>
            )}
          </button>

          <div
            data-ui="admin/OrdersBrowser/div-grid"
            className="grid w-full grid-cols-2 gap-2 sm:ml-auto sm:flex sm:w-auto sm:items-center"
          >
            <SelectField
              label="Financial year"
              hideLabel
              activeFilter={period.year !== currentFy}
              fieldSize="md"
              noErrorSpace
              containerClassName="w-full sm:w-36"
              value={period.year}
              onValueChange={(y) => go({ year: y, month: y === currentFy ? currentYm : "all" })}
              options={yearOptions}
            />
            <SelectField
              label="Month"
              hideLabel
              activeFilter={period.month !== currentYm}
              fieldSize="md"
              noErrorSpace
              disabled={period.year === "all"}
              containerClassName="w-full sm:w-44"
              value={period.month}
              onValueChange={(m) => go({ month: m })}
              options={monthOptions}
            />
          </div>
        </div>

        {/* Row 2: Status / Payment / Returns Dropdowns + Reset */}
        <div
          data-ui="admin/OrdersBrowser/div-2"
          className={cn(
            "grid-cols-2 gap-2 border-t pt-2.5 sm:flex sm:flex-wrap sm:items-center",
            mobileOpen || activeCategoryFilterCount > 0 ? "grid" : "hidden sm:flex"
          )}
        >
          <SelectField
            label="Order status"
            hideLabel
            prefix="Status:"
            activeFilter={status !== "all"}
            fieldSize="md"
            noErrorSpace
            containerClassName="w-full sm:w-44"
            value={status}
            onValueChange={(s) => go(s === "to-ship" ? { view: "to-ship" } : { status: s })}
            options={statusOptions}
          />
          <SelectField
            label="Payment status"
            hideLabel
            prefix="Payment:"
            activeFilter={payment !== "all"}
            fieldSize="md"
            noErrorSpace
            containerClassName="w-full sm:w-44"
            value={payment}
            onValueChange={(p) => go({ payment: p })}
            options={paymentOptions}
          />
          <SelectField
            label="Return status"
            hideLabel
            prefix="Returns:"
            activeFilter={returnView !== "none"}
            fieldSize="md"
            noErrorSpace
            containerClassName="col-span-2 w-full sm:w-52"
            value={returnView}
            onValueChange={(v) => go(v === "none" ? { view: "", status: "all", payment: "all" } : { view: v })}
            options={returnOptions}
          />

          {hasActiveFilters && (
            <button
              data-ui="admin/OrdersBrowser/button-reset"
              type="button"
              onClick={() => {
                setQuery("")
                setMobileOpen(false)
                go({ view: "", status: "all", payment: "all", q: "", year: currentFy, month: currentYm })
              }}
              className="col-span-2 inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border bg-background px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:ml-auto sm:w-auto"
            >
              <RotateCcwIcon className="size-3.5" aria-hidden /> Reset
            </button>
          )}
        </div>
      </div>

      <div data-ui="admin/OrdersBrowser/div-3" aria-busy={pending}>{pending ? <Skeletonize><OrdersTable orders={placeholderOrders(ORDERS_SKELETON_ROWS)} /></Skeletonize> : children}</div>
    </div>
  )
}

export type CustomerOrderTabCategory = "active" | "delivered" | "cancelled" | "refund"

export type CustomerOrderRenderItem = {
  id: string
  category: "active" | "delivered" | "cancelled"
  hasRefund?: boolean
  refundPending?: boolean
  searchText?: string
  node: ReactNode
}

export type CustomerOrderFilters = {
  year?: string
  month?: string
  status?: string
  today?: string
  statusCounts?: CustomerOrderStatusCounts
  items?: CustomerOrderRenderItem[]
  emptyPeriodNode?: ReactNode
  emptyTabNode?: ReactNode
  skeletonNode?: ReactNode
}

export function CustomerOrdersFilterBar(current: CustomerOrderFilters) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [applied, setApplied] = useOptimistic<CustomerOrderFilters, CustomerOrderFilters>(current, (state, next) => ({ ...state, ...next }))
  const [status, setStatus] = useState(current.status ?? "all")
  const [query, setQuery] = useState("")
  const deferredQuery = useDeferredValue(query)
  useEffect(() => {
    setStatus(current.status ?? "all")
  }, [current.status])

  const today = current.today ?? PLACEHOLDER_TODAY
  const currentFy = String(fyYearOf(today))
  const currentYm = today.slice(0, 7)
  const period = resolveOrderPeriod({ year: applied.year, month: applied.month }, today)
  const yearOptions = orderYearOptions(today, period.year)
  const monthOptions = orderMonthOptions(today, period.year)

  const rawItems = current.items
  const trimmedQuery = deferredQuery.trim().toLowerCase()
  const queryTokens = trimmedQuery ? trimmedQuery.split(/\s+/) : []
  const items = rawItems
    ? queryTokens.length > 0
      ? rawItems.filter((i) => {
          const haystack = (i.searchText ?? "").toLowerCase()
          return queryTokens.every((tok) => haystack.includes(tok))
        })
      : rawItems
    : undefined

  const sc = current.statusCounts
  const activeCount = items ? items.filter((i) => i.category === "active").length : sc?.active
  const deliveredCount = items ? items.filter((i) => i.category === "delivered").length : sc?.delivered
  const cancelledCount = items ? items.filter((i) => i.category === "cancelled").length : sc?.cancelled
  const refundCount = items ? items.filter((i) => i.hasRefund).length : undefined
  const refundPendingCount = items ? items.filter((i) => i.refundPending).length : 0
  const totalCount = items ? items.length : sc ? sc.active + sc.delivered + sc.cancelled : undefined

  const statusTabs = [
    { value: "all", label: "All", count: totalCount, attention: false },
    { value: "active", label: "Active", count: activeCount, attention: (activeCount ?? 0) > 0 },
    { value: "delivered", label: "Delivered", count: deliveredCount, attention: false },
    { value: "cancelled", label: "Cancelled", count: cancelledCount, attention: false },
    { value: "refund", label: "Refund", count: refundCount, attention: refundPendingCount > 0 },
  ]
  const hasPeriodFilter = period.year !== currentFy || period.month !== currentYm
  const hasActiveFilters = Boolean(trimmedQuery) || status !== "all" || hasPeriodFilter

  const buildPeriodUrl = (nextYear: string, nextMonth: string) => {
    const sp = new URLSearchParams()
    if (nextYear !== currentFy || nextMonth !== currentYm) {
      sp.set("year", nextYear)
      if (nextYear !== "all") sp.set("month", nextMonth)
    }
    return `/account/orders${sp.size ? `?${sp}` : ""}`
  }

  /** Instant 0ms pure client-side tab switch — no URL change or router navigation. */
  const selectTab = (nextStatus: string) => {
    setStatus(nextStatus)
  }

  /** Period change — fetches the selected year/month from the server. */
  const goPeriod = (next: { year?: string; month?: string; status?: string }) => {
    if (next.status !== undefined) setStatus(next.status)
    const resolved = resolveOrderPeriod({ year: next.year ?? applied.year, month: next.month ?? applied.month }, today)
    const url = buildPeriodUrl(resolved.year, resolved.month)
    startTransition(() => {
      setApplied({ year: resolved.year, month: resolved.month })
      router.push(url)
    })
  }

  const visibleItems = items
    ? items.filter((i) => {
        if (status === "all") return true
        if (status === "refund") return Boolean(i.hasRefund)
        return i.category === status
      })
    : []

  return (
    <div data-ui="admin/CustomerOrdersFilterBar">
      <div data-ui="admin/CustomerOrdersFilterBar/div" className="mb-6 space-y-2.5 rounded-2xl border bg-card p-3 sm:p-4">
        {/* Row 1: Instant Search Box + Financial Year & Month */}
        <div data-ui="admin/CustomerOrdersFilterBar/div-flex" className="flex flex-wrap items-center gap-2">
          <div data-ui="admin/CustomerOrdersFilterBar/div-2" className="min-w-0 flex-1">
            <SearchField
              label="Search my orders"
              maxLength={LIMITS.orderSearch.max}
              fieldSize="md"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onClear={() => setQuery("")}
              placeholder="Search product, order ID, city, tracking or UTR…"
            />
          </div>

          <div data-ui="admin/CustomerOrdersFilterBar/div-grid" className="grid w-full grid-cols-2 gap-2 sm:ml-auto sm:flex sm:w-auto sm:items-center">
            <SelectField
              label="Financial year"
              hideLabel
              activeFilter={period.year !== currentFy}
              fieldSize="md"
              noErrorSpace
              containerClassName="w-full sm:w-36"
              value={period.year}
              onValueChange={(y) => goPeriod({ year: y, month: y === currentFy ? currentYm : "all" })}
              options={yearOptions}
            />
            <SelectField
              label="Month"
              hideLabel
              activeFilter={period.month !== currentYm}
              fieldSize="md"
              noErrorSpace
              disabled={period.year === "all"}
              containerClassName="w-full sm:w-44"
              value={period.month}
              onValueChange={(m) => goPeriod({ month: m })}
              options={monthOptions}
            />
          </div>
        </div>

        {/* Row 2: Status Tabs (All, Active, Delivered, Cancelled, Refund) + Reset */}
        <div data-ui="admin/CustomerOrdersFilterBar/div-flex-2" className="flex flex-wrap items-center justify-between gap-2 border-t pt-2.5">
          <div
            data-ui="admin/CustomerOrdersFilterBar/div-order-status"
            role="group"
            aria-label="Order status"
            className="scroll-row flex w-full items-center gap-1.5 rounded-xl bg-muted/60 p-1 sm:w-auto"
          >
            {statusTabs.map((tab) => {
              const isSelected = status === tab.value
              return (
                <button
                  data-ui="admin/CustomerOrdersFilterBar/button"
                  key={tab.value}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => selectTab(tab.value)}
                  className={cn(
                    "inline-flex h-8 flex-1 shrink-0 items-center justify-center gap-1.5 rounded-lg px-3.5 text-xs font-medium transition-all sm:flex-initial",
                    isSelected
                      ? "bg-primary font-semibold text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-background/80 hover:text-foreground"
                  )}
                >
                  <span data-ui="admin/CustomerOrdersFilterBar/span">{tab.label}</span>
                  {tab.count !== undefined && (
                    <span
                      data-ui="admin/CustomerOrdersFilterBar/span-2"
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums leading-none",
                        isSelected
                          ? "bg-primary-foreground/20 text-primary-foreground"
                          : tab.attention
                            ? "bg-amber-500/15 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300"
                            : "bg-background text-muted-foreground"
                      )}
                    >
                      {tab.attention && !isSelected && <span data-ui="admin/CustomerOrdersFilterBar/span-3" className="size-1.5 rounded-full bg-amber-500" aria-hidden />}
                      {tab.count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {hasActiveFilters && (
            <button
              data-ui="admin/CustomerOrdersFilterBar/button-reset"
              type="button"
              onClick={() => {
                setQuery("")
                if (!hasPeriodFilter) {
                  selectTab("all")
                } else {
                  goPeriod({ status: "all", year: currentFy, month: currentYm })
                }
              }}
              className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border bg-background px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:ml-auto sm:w-auto"
            >
              <RotateCcwIcon className="size-3.5" aria-hidden /> Reset
            </button>
          )}
        </div>
      </div>

      {rawItems && (
        <div data-ui="admin/CustomerOrdersFilterBar/div-3" aria-busy={pending}>
          {pending ? (
            <Skeletonize>{current.skeletonNode}</Skeletonize>
          ) : rawItems.length === 0 && !trimmedQuery ? (
            current.emptyPeriodNode
          ) : visibleItems.length === 0 ? (
            trimmedQuery && period.year !== "all" ? (
              <div data-ui="admin/CustomerOrdersFilterBar/div-flex-3" className="flex flex-col items-center gap-3 rounded-3xl border border-dashed py-12 text-center">
                <p data-ui="admin/CustomerOrdersFilterBar/p" className="font-heading text-xl">
                  No orders matching &ldquo;{query.trim()}&rdquo; in this period
                </p>
                <p data-ui="admin/CustomerOrdersFilterBar/p-2" className="max-w-sm text-sm text-muted-foreground">
                  Search across all your past orders to find older purchases.
                </p>
                <div data-ui="admin/CustomerOrdersFilterBar/div-flex-4" className="flex flex-wrap justify-center gap-2.5">
                  <button
                    data-ui="admin/CustomerOrdersFilterBar/button-search-in-all-time-ord"
                    type="button"
                    onClick={() => goPeriod({ status: "all", year: "all", month: "all" })}
                    className="inline-flex h-10 items-center justify-center rounded-full bg-primary px-5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    Search in all-time orders
                  </button>
                  <button
                    data-ui="admin/CustomerOrdersFilterBar/button-clear-search"
                    type="button"
                    onClick={() => setQuery("")}
                    className="inline-flex h-10 items-center justify-center rounded-full border bg-background px-5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                  >
                    Clear search
                  </button>
                </div>
              </div>
            ) : (
              current.emptyTabNode
            )
          ) : (
            <ul data-ui="admin/CustomerOrdersFilterBar/ul" className="space-y-3">
              {visibleItems.map((item) => (
                <li data-ui="admin/CustomerOrdersFilterBar/li" key={item.id}>
                  {item.node}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
