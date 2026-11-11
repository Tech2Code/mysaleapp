"use client"

import { XIcon } from "lucide-react"
import { LIMITS } from "@/lib/validation"
import { useRouter } from "next/navigation"
import { useEffect, useOptimistic, useRef, useState, useTransition, type ReactNode } from "react"
import { OrdersTable } from "@/components/admin/orders-table"
import { SearchField } from "@/components/form"
import { Skeletonize } from "@/components/shared/skeletonize"
import { placeholderOrders } from "@/features/orders/placeholders"
import type { ReturnViewCounts } from "@/features/orders/admin-queries"
import { isOrderView, ORDER_VIEWS, RETURN_VIEWS } from "@/features/orders/views"
import { ORDER_STATUSES, STATUS_META } from "@/features/orders/types"
import { cn } from "@/lib/utils"

const PAYMENT_TABS = [
  { value: "all", label: "Any payment" },
  { value: "submitted", label: "To verify" },
  { value: "pending", label: "Unpaid" },
  { value: "paid", label: "Paid" },
]

/** Placeholder rows shown while the list reloads. */
const ORDERS_SKELETON_ROWS = 20

type Filters = { status?: string; payment?: string; view?: string; q?: string }

/**
 * Filters + results for the admin orders list.
 * - Chips switch instantly (optimistic), so the next filter can be clicked straight away; the last click wins.
 * - While the server list reloads, a skeleton replaces it (no top progress bar: that is for page changes).
 * - `children` is the server-rendered list.
 */
export function OrdersBrowser({ children, returnCounts, ...current }: Filters & { children: ReactNode; returnCounts?: ReturnViewCounts }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [applied, setApplied] = useOptimistic<Filters, Filters>(current, (state, next) => ({ ...state, ...next }))
  const [query, setQuery] = useState(current.q ?? "")
  const [prevServerQ, setPrevServerQ] = useState(current.q ?? "")
  if ((current.q ?? "") !== prevServerQ) {
    setPrevServerQ(current.q ?? "")
    setQuery(current.q ?? "")
  }
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const go = (next: Filters) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    const merged: Filters = { ...applied, ...next }
    // picking a status/payment chip leaves any dashboard "view"; picking a view replaces the chips
    if (next.status !== undefined || next.payment !== undefined) merged.view = undefined
    if (next.view !== undefined) {
      merged.status = undefined
      merged.payment = undefined
    }
    const sp = new URLSearchParams()
    if (merged.view && isOrderView(merged.view)) sp.set("view", merged.view)
    if (merged.status && merged.status !== "all") sp.set("status", merged.status)
    if (merged.payment && merged.payment !== "all") sp.set("payment", merged.payment)
    if (merged.q?.trim()) sp.set("q", merged.q.trim())
    startTransition(() => {
      setApplied(merged)
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
  const status = applied.status ?? "all"
  const payment = applied.payment ?? "all"

  return (
    <div data-ui="admin/OrdersBrowser">
      <div data-ui="admin/OrdersBrowser/div" className="mb-4 space-y-3">
        <form data-ui="admin/OrdersBrowser/form"
          onSubmit={(e) => {
            e.preventDefault()
            go({ q: query })
          }}
          className="max-w-md"
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
            placeholder="Search by order code, phone or name…"
          />
        </form>

        {view && (
          <p data-ui="admin/OrdersBrowser/p-flex" className="flex items-center gap-2 text-sm">
            <span data-ui="admin/OrdersBrowser/span" className="text-muted-foreground">Showing</span>
            <button data-ui="admin/OrdersBrowser/button-inline-flex"
              type="button"
              onClick={() => go({ view: "", status: "all", payment: "all" })}
              className="inline-flex h-8 items-center gap-1.5 rounded-full bg-primary/10 pr-2 pl-3 font-semibold text-primary transition-colors hover:bg-primary/15"
              aria-label={`${ORDER_VIEWS[view].label}, clear this filter`}
            >
              {ORDER_VIEWS[view].label}
              <XIcon className="size-3.5" aria-hidden />
            </button>
          </p>
        )}

        <div data-ui="admin/OrdersBrowser/div-filter-by-status" className="scroll-row flex gap-2" role="group" aria-label="Filter by status">
          {["all", ...ORDER_STATUSES].map((t) => {
            const active = !view && status === t
            return (
              <button data-ui="admin/OrdersBrowser/button"
                key={t}
                type="button"
                aria-pressed={active}
                onClick={() => go({ status: t })}
                className={cn(
                  "h-9 shrink-0 rounded-full border px-3.5 text-sm font-medium transition-colors",
                  active ? "border-transparent bg-primary text-primary-foreground" : "bg-card hover:bg-muted"
                )}
              >
                {t === "all" ? "All" : STATUS_META[t as keyof typeof STATUS_META].label}
              </button>
            )
          })}
        </div>
        <div data-ui="admin/OrdersBrowser/div-filter-by-payment" className="scroll-row flex gap-2" role="group" aria-label="Filter by payment">
          {PAYMENT_TABS.map((t) => {
            const active = !view && payment === t.value
            return (
              <button data-ui="admin/OrdersBrowser/button-2"
                key={t.value}
                type="button"
                aria-pressed={active}
                onClick={() => go({ payment: t.value })}
                className={cn(
                  "h-8 shrink-0 rounded-full border px-3 text-xs font-medium transition-colors",
                  active ? "border-transparent bg-foreground text-background" : "bg-card hover:bg-muted"
                )}
              >
                {t.label}
              </button>
            )
          })}
        </div>
        <div data-ui="admin/OrdersBrowser/div-filter-by-return" className="scroll-row flex gap-2" role="group" aria-label="Filter by return">
          {RETURN_VIEWS.map((v) => {
            const active = view === v
            const count = returnCounts?.[v]
            return (
              <button data-ui="admin/OrdersBrowser/button-3"
                key={v}
                type="button"
                aria-pressed={active}
                onClick={() => (active ? go({ view: "", status: "all", payment: "all" }) : go({ view: v }))}
                className={cn(
                  "h-8 shrink-0 rounded-full border px-3 text-xs font-medium transition-colors",
                  active ? "border-transparent bg-primary text-primary-foreground" : "bg-card hover:bg-muted"
                )}
              >
                {ORDER_VIEWS[v].label}
                {count !== undefined && <span data-ui="admin/OrdersBrowser/span-2" className="ml-1.5 tabular-nums opacity-70">{count}</span>}
              </button>
            )
          })}
        </div>
      </div>

      <div data-ui="admin/OrdersBrowser/div-2" aria-busy={pending}>{pending ? <Skeletonize><OrdersTable orders={placeholderOrders(ORDERS_SKELETON_ROWS)} /></Skeletonize> : children}</div>
    </div>
  )
}
