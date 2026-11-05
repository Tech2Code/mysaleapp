"use client"

import { XIcon } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useOptimistic, useState, useTransition, type ReactNode } from "react"
import { SearchField } from "@/components/form"
import { isOrderView, ORDER_VIEWS } from "@/features/orders/views"
import { ORDER_STATUSES, STATUS_META } from "@/features/orders/types"
import { cn } from "@/lib/utils"

const PAYMENT_TABS = [
  { value: "all", label: "Any payment" },
  { value: "submitted", label: "To verify" },
  { value: "pending", label: "Unpaid" },
  { value: "paid", label: "Paid" },
]

type Filters = { status?: string; payment?: string; view?: string; q?: string }

function ResultsSkeleton() {
  return (
    <div data-ui="admin/ResultsSkeleton" className="overflow-hidden rounded-2xl border bg-card" aria-hidden>
      {Array.from({ length: 6 }, (_, i) => (
        <div data-ui="admin/ResultsSkeleton/div-flex" key={i} className="flex items-center gap-4 border-b p-4 last:border-0">
          <div data-ui="admin/ResultsSkeleton/div" className="h-4 w-20 animate-pulse rounded bg-muted" />
          <div data-ui="admin/ResultsSkeleton/div-2" className="flex-1 space-y-2">
            <div data-ui="admin/ResultsSkeleton/div-3" className="h-3.5 w-1/3 animate-pulse rounded bg-muted" />
            <div data-ui="admin/ResultsSkeleton/div-4" className="h-3 w-1/4 animate-pulse rounded bg-muted/70" />
          </div>
          <div data-ui="admin/ResultsSkeleton/div-5" className="h-6 w-20 animate-pulse rounded-full bg-muted" />
          <div data-ui="admin/ResultsSkeleton/div-6" className="h-4 w-14 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  )
}

/**
 * Filters + results for the admin orders list.
 * - Chips switch instantly (optimistic), so the next filter can be clicked straight away; the last click wins.
 * - While the server list reloads, a skeleton replaces it (no top progress bar: that is for page changes).
 * - `children` is the server-rendered list.
 */
export function OrdersBrowser({ children, ...current }: Filters & { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [pending, startTransition] = useTransition()
  const [applied, setApplied] = useOptimistic<Filters, Filters>(current, (state, next) => ({ ...state, ...next }))
  const [query, setQuery] = useState(current.q ?? "")

  const go = (next: Filters) => {
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
      router.push(`${pathname}${sp.size ? `?${sp}` : ""}`)
    })
  }

  // Search as you type: wait for a short pause, then update the list.
  useEffect(() => {
    const typed = query.trim()
    if (typed === (applied.q ?? "").trim()) return
    const timer = setTimeout(() => go({ q: typed }), 350)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `go` is recreated every render; only typing should retrigger
  }, [query])

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
      </div>

      <div data-ui="admin/OrdersBrowser/div-2" aria-busy={pending}>{pending ? <ResultsSkeleton /> : children}</div>
    </div>
  )
}
