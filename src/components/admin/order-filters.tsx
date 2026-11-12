"use client"

import { RotateCcwIcon, SlidersHorizontalIcon } from "lucide-react"
import { LIMITS } from "@/lib/validation"
import { useRouter } from "next/navigation"
import { useEffect, useOptimistic, useRef, useState, useTransition, type ReactNode } from "react"
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

  // Search as you type: wait for a short pause, then update the list.
  useEffect(() => {
    const typed = query.trim()
    if (typed === (applied.q ?? "").trim()) return
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

export type CustomerOrderFilters = { year?: string; month?: string; status?: string; today?: string; statusCounts?: CustomerOrderStatusCounts }

export function CustomerOrdersFilterBar(current: CustomerOrderFilters) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [applied, setApplied] = useOptimistic<CustomerOrderFilters, CustomerOrderFilters>(current, (state, next) => ({ ...state, ...next }))
  const today = current.today ?? PLACEHOLDER_TODAY
  const currentFy = String(fyYearOf(today))
  const currentYm = today.slice(0, 7)
  const period = resolveOrderPeriod({ year: applied.year, month: applied.month }, today)
  const yearOptions = orderYearOptions(today, period.year)
  const monthOptions = orderMonthOptions(today, period.year)
  const status = applied.status ?? "all"
  const sc = current.statusCounts
  const statusOptions: SelectOption[] = [
    {
      value: "all",
      label: "All",
      badge: sc && sc.active > 0 ? String(sc.active) : undefined,
      tone: sc && sc.active > 0 ? "attention" : "default",
    },
    { value: "active", label: "Active (in progress)", badge: sc ? String(sc.active) : undefined, tone: (sc?.active ?? 0) > 0 ? "attention" : "default" },
    { value: "delivered", label: "Delivered", badge: sc ? String(sc.delivered) : undefined },
    { value: "cancelled", label: "Cancelled", badge: sc ? String(sc.cancelled) : undefined },
  ]
  const hasActiveFilters = status !== "all" || period.year !== currentFy || period.month !== currentYm

  const go = (next: CustomerOrderFilters) => {
    const merged: CustomerOrderFilters = { ...applied, ...next }
    const resolved = resolveOrderPeriod({ year: merged.year, month: merged.month }, today)
    const sp = new URLSearchParams()
    if (merged.status && merged.status !== "all") sp.set("status", merged.status)
    if (resolved.year !== currentFy || resolved.month !== currentYm) {
      sp.set("year", resolved.year)
      if (resolved.year !== "all") sp.set("month", resolved.month)
    }
    startTransition(() => {
      setApplied({ status: merged.status ?? "all", year: resolved.year, month: resolved.month })
      router.push(`/account/orders${sp.size ? `?${sp}` : ""}`)
    })
  }

  return (
    <div data-ui="admin/CustomerOrdersFilterBar" className="mb-6 grid grid-cols-2 gap-2.5 rounded-2xl border bg-card p-3 sm:flex sm:flex-wrap sm:items-center sm:p-4">
      <SelectField
        label="Order status"
        hideLabel
        prefix="Status:"
        activeFilter={status !== "all"}
        fieldSize="md"
        noErrorSpace
        containerClassName="col-span-2 w-full sm:w-44"
        value={status}
        onValueChange={(s) => go({ status: s })}
        options={statusOptions}
      />
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
      {hasActiveFilters && (
        <button
          data-ui="admin/CustomerOrdersFilterBar/button-reset"
          type="button"
          onClick={() => go({ status: "all", year: currentFy, month: currentYm })}
          className="col-span-2 inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border bg-background px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:ml-auto sm:w-auto"
        >
          <RotateCcwIcon className="size-3.5" aria-hidden /> Reset
        </button>
      )}
    </div>
  )
}
