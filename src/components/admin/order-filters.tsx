"use client"

import { SearchIcon } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { Input } from "@/components/ui/input"
import { ORDER_STATUSES, STATUS_META } from "@/features/orders/types"
import { cn } from "@/lib/utils"

export function OrderFilters({ status, q }: { status?: string; q?: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const [query, setQuery] = useState(q ?? "")
  const [pending, startTransition] = useTransition()

  const go = (next: { status?: string; q?: string }) => {
    const sp = new URLSearchParams()
    const s = next.status ?? status
    const text = next.q ?? query
    if (s && s !== "all") sp.set("status", s)
    if (text.trim()) sp.set("q", text.trim())
    startTransition(() => router.push(`${pathname}${sp.size ? `?${sp}` : ""}`))
  }

  const tabs = ["all", ...ORDER_STATUSES]

  return (
    <div className={cn("mb-4 space-y-3 transition-opacity", pending && "opacity-60")}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          go({ q: query })
        }}
        className="relative max-w-md"
        role="search"
      >
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by order code, phone or name…"
          aria-label="Search orders"
          className="h-10 pl-9"
        />
      </form>
      <div className="no-scrollbar flex gap-2 overflow-x-auto" role="group" aria-label="Filter by status">
        {tabs.map((t) => {
          const active = (status ?? "all") === t
          return (
            <button
              key={t}
              type="button"
              aria-pressed={active}
              onClick={() => go({ status: t })}
              className={cn(
                "shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                active ? "border-transparent bg-primary text-primary-foreground" : "bg-card hover:bg-muted"
              )}
            >
              {t === "all" ? "All" : STATUS_META[t as keyof typeof STATUS_META].label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
