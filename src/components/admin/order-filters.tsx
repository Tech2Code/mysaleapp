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
import styles from "./admin-orders.module.css"

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
    const rawTyped = query.trim()
    if (rawTyped.length === 1) return
    const effective = rawTyped.length >= 2 ? rawTyped : ""
    if (effective === (applied.q ?? "").trim()) return
    const timer = setTimeout(() => {
      timerRef.current = null
      goRef.current({ q: effective })
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
  const paymentAttentionCount = pc ? pc.submitted + pc.failed + pc.pending + pc["refund-due"] : 0
  const paymentOptions: SelectOption[] = [
    {
      value: "all",
      label: "Any",
      badge: paymentAttentionCount > 0 ? String(paymentAttentionCount) : undefined,
      tone: paymentAttentionCount > 0 ? "attention" : "default",
    },
    { value: "submitted", label: "To verify", badge: pc ? String(pc.submitted) : undefined, tone: (pc?.submitted ?? 0) > 0 ? "attention" : "default" },
    { value: "failed", label: "Rejected", badge: pc ? String(pc.failed) : undefined, tone: (pc?.failed ?? 0) > 0 ? "attention" : "default" },
    { value: "pending", label: "Awaiting payment", badge: pc ? String(pc.pending) : undefined, tone: (pc?.pending ?? 0) > 0 ? "attention" : "default" },
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
    <div>
      <div className={cn("adminCard", styles.browserCard)}>
        {/* Row 1: Search + Mobile Filter Toggle + Financial Year & Month */}
        <div className={styles.topFilterRow}>
          <form

            onSubmit={(e) => {
              e.preventDefault()
              go({ q: query })
            }}
            className={styles.searchForm}
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

            type="button"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((v) => !v)}
            className={cn(
              styles.mobileFilterToggle,
              (activeCategoryFilterCount > 0 || mobileOpen) && styles.mobileFilterToggleActive
            )}
          >
            <SlidersHorizontalIcon className={styles.iconSm} aria-hidden />
            <span>Filters</span>
            {activeCategoryFilterCount > 0 && (
              <span className={styles.filterCountBadge}>
                {activeCategoryFilterCount}
              </span>
            )}
          </button>

          <div

            className={styles.periodSelectGroup}
          >
            <SelectField
              label="Financial year"
              hideLabel
              activeFilter={period.year !== currentFy}
              fieldSize="md"
              noErrorSpace
              containerClassName={styles.selectWidth36}
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
              containerClassName={styles.selectWidth44}
              value={period.month}
              onValueChange={(m) => go({ month: m })}
              options={monthOptions}
            />
          </div>
        </div>

        {/* Row 2: Status / Payment / Returns Dropdowns + Reset */}
        <div

          className={cn(styles.bottomFilterRow, mobileOpen && styles.bottomFilterRowOpen)}
        >
          <SelectField
            label="Order status"
            hideLabel
            prefix="Status:"
            activeFilter={status !== "all"}
            fieldSize="md"
            noErrorSpace
            containerClassName={styles.selectWidth44}
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
            containerClassName={styles.selectWidth44}
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
            containerClassName={styles.selectSpan2Width52}
            value={returnView}
            onValueChange={(v) => go(v === "none" ? { view: "", status: "all", payment: "all" } : { view: v })}
            options={returnOptions}
          />

          {hasActiveFilters && (
            <button

              type="button"
              onClick={() => {
                setQuery("")
                setMobileOpen(false)
                go({ view: "", status: "all", payment: "all", q: "", year: currentFy, month: currentYm })
              }}
              className={styles.resetFilterBtn}
            >
              <RotateCcwIcon className={styles.iconSm} aria-hidden /> Reset
            </button>
          )}
        </div>
      </div>

      <div aria-busy={pending}>{pending ? <Skeletonize><OrdersTable orders={placeholderOrders(ORDERS_SKELETON_ROWS)} /></Skeletonize> : children}</div>
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

const CUSTOMER_ORDER_MIN_SEARCH_CHARS = 2
const CUSTOMER_ORDER_DEBOUNCE_MS = 300

export function CustomerOrdersFilterBar(current: CustomerOrderFilters) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [applied, setApplied] = useOptimistic<CustomerOrderFilters, CustomerOrderFilters>(current, (state, next) => ({ ...state, ...next }))
  const [status, setStatus] = useState(current.status ?? "all")
  const [prevServerStatus, setPrevServerStatus] = useState(current.status ?? "all")
  if ((current.status ?? "all") !== prevServerStatus) {
    setPrevServerStatus(current.status ?? "all")
    setStatus(current.status ?? "all")
  }
  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")

  // Debounce search by 300ms and enforce a 2-character minimum gate (clearing is instant)
  useEffect(() => {
    const typed = query.trim()
    if (typed.length < CUSTOMER_ORDER_MIN_SEARCH_CHARS) return
    const timer = window.setTimeout(() => {
      setDebouncedQuery(typed)
    }, CUSTOMER_ORDER_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [query])

  const handleQueryChange = (val: string) => {
    setQuery(val)
    if (val.trim().length < CUSTOMER_ORDER_MIN_SEARCH_CHARS) {
      setDebouncedQuery("")
    }
  }

  const clearSearch = () => {
    setQuery("")
    setDebouncedQuery("")
  }

  const today = current.today ?? PLACEHOLDER_TODAY
  const currentFy = String(fyYearOf(today))
  const currentYm = today.slice(0, 7)
  const period = resolveOrderPeriod({ year: applied.year, month: applied.month }, today)
  const yearOptions = orderYearOptions(today, period.year)
  const monthOptions = orderMonthOptions(today, period.year)

  const rawItems = current.items
  const trimmedQuery = query.trim().length < CUSTOMER_ORDER_MIN_SEARCH_CHARS ? "" : debouncedQuery.trim().toLowerCase()
  const queryTokens = trimmedQuery.length >= CUSTOMER_ORDER_MIN_SEARCH_CHARS ? trimmedQuery.split(/\s+/) : []
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
  const hasActiveFilters = Boolean(query.trim()) || status !== "all" || hasPeriodFilter

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
    <div>
      <div className={styles.customerFilterCard}>
        {/* Row 1: Debounced Search Box + Financial Year & Month */}
        <div className={styles.topFilterRow}>
          <div className={styles.searchForm}>
            <SearchField
              label="Search my orders"
              maxLength={LIMITS.orderSearch.max}
              fieldSize="md"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              onClear={clearSearch}
              placeholder="Search product, order ID, city, tracking or UTR…"
            />
          </div>

          <div className={styles.periodSelectGroup}>
            <SelectField
              label="Financial year"
              hideLabel
              activeFilter={period.year !== currentFy}
              fieldSize="md"
              noErrorSpace
              containerClassName={styles.selectWidth36}
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
              containerClassName={styles.selectWidth44}
              value={period.month}
              onValueChange={(m) => goPeriod({ month: m })}
              options={monthOptions}
            />
          </div>
        </div>

        {/* Row 2: Status Tabs (All, Active, Delivered, Cancelled, Refund) + Reset */}
        <div className={styles.tabsRow}>
          <div

            role="group"
            aria-label="Order status"
            className={cn("no-scrollbar", styles.statusTabsGroup)}
          >
            {statusTabs.map((tab) => {
              const isSelected = status === tab.value
              return (
                <button

                  key={tab.value}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => selectTab(tab.value)}
                  className={cn(styles.statusTabBtn, isSelected && styles.statusTabBtnSelected)}
                >
                  <span>{tab.label}</span>
                  {tab.count !== undefined && (
                    <span

                      className={cn(
                        styles.tabCountBadge,
                        isSelected
                          ? styles.tabCountSelected
                          : tab.attention
                            ? styles.tabCountAttention
                            : styles.tabCountDefault
                      )}
                    >
                      {tab.attention && !isSelected && <span className={styles.attentionDot} aria-hidden />}
                      {tab.count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {hasActiveFilters && (
            <button

              type="button"
              onClick={() => {
                clearSearch()
                if (!hasPeriodFilter) {
                  selectTab("all")
                } else {
                  goPeriod({ status: "all", year: currentFy, month: currentYm })
                }
              }}
              className={styles.customerResetBtn}
            >
              <RotateCcwIcon className={styles.iconSm} aria-hidden /> Reset
            </button>
          )}
        </div>
      </div>

      {rawItems && (
        <div aria-busy={pending}>
          {pending ? (
            <Skeletonize>{current.skeletonNode}</Skeletonize>
          ) : rawItems.length === 0 && !trimmedQuery ? (
            current.emptyPeriodNode
          ) : visibleItems.length === 0 ? (
            trimmedQuery && period.year !== "all" ? (
              <div className={styles.noSearchMatchBox}>
                <p className={styles.noMatchTitle}>
                  No orders matching &ldquo;{debouncedQuery.trim()}&rdquo; in this period
                </p>
                <p className={styles.noMatchSub}>
                  Search across all your past orders to find older purchases.
                </p>
                <div className={styles.noMatchActions}>
                  <button

                    type="button"
                    onClick={() => goPeriod({ status: "all", year: "all", month: "all" })}
                    className={styles.allTimeBtn}
                  >
                    Search in all-time orders
                  </button>
                  <button

                    type="button"
                    onClick={clearSearch}
                    className={styles.clearSearchBtn}
                  >
                    Clear search
                  </button>
                </div>
              </div>
            ) : (
              current.emptyTabNode
            )
          ) : (
            <ul className={styles.customerOrdersList}>
              {visibleItems.map((item) => (
                <li key={item.id}>
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
