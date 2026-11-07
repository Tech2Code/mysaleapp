"use client"

import { RefreshCwIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { useProgressWhile } from "./route-progress"

/**
 * Re-fetches the current page's data in place (no full reload, scroll position kept). For pages whose state
 * changes from elsewhere (an order's status / payment / return), so nobody has to press F5.
 * The top progress bar shows while it loads.
 */
export function RefreshButton({ label = "Refresh", onRefresh }: { label?: string; /** Pages that load their data in the browser (not via the server): refetch it here. Default: router.refresh(). */ onRefresh?: () => Promise<void> | void }) {
  const router = useRouter()
  const [pendingTransition, startTransition] = useTransition()
  const [pendingCall, setPendingCall] = useState(false)
  const pending = pendingTransition || pendingCall
  useProgressWhile(pending)

  const refresh = async () => {
    if (!onRefresh) return startTransition(() => router.refresh())
    setPendingCall(true)
    try {
      await onRefresh()
    } finally {
      setPendingCall(false)
    }
  }

  return (
    <button
      data-ui="shared/RefreshButton"
      type="button"
      onClick={() => void refresh()}
      disabled={pending}
      aria-busy={pending}
      className="inline-flex h-9 items-center gap-2 rounded-full border px-4 text-sm font-semibold hover:bg-muted disabled:opacity-70"
    >
      <RefreshCwIcon className={pending ? "size-4 animate-spin" : "size-4"} aria-hidden /> {label}
    </button>
  )
}
