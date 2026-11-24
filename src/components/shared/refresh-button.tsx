"use client"

import { RefreshCwIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { useProgressWhile } from "./route-progress"
import styles from "./shared.module.css"

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

      type="button"
      onClick={() => void refresh()}
      disabled={pending}
      aria-busy={pending}
      className={styles.refreshBtn}
    >
      <RefreshCwIcon className={pending ? styles.icon16Spin : styles.icon16} aria-hidden /> {label}
    </button>
  )
}
