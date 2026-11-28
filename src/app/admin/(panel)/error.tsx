"use client"

import { ArrowLeftIcon, RotateCcwIcon } from "lucide-react"
import Link from "next/link"
import { useEffect } from "react"
import { Button, buttonVariants } from "@/components/ui/button"
import styles from "@/app/(store)/store-layout.module.css"

export default function AdminPanelError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[admin-error]", error.digest ?? error.message)
  }, [error])

  return (
    <section className={styles.errorCenterMain} aria-labelledby="admin-error-title">
      <div>
        <h1 id="admin-error-title" className={styles.statusPageTitle}>
          Something went wrong
        </h1>
        <p className={styles.statusPageLead}>
          This admin screen encountered an unexpected error. Try reloading or return to the dashboard.
        </p>
        <div className={styles.notFoundBtnsRow}>
          <Button type="button" onClick={reset} size="lg">
            <RotateCcwIcon aria-hidden="true" /> Try again
          </Button>
          <Link href="/admin" className={buttonVariants({ variant: "outline", size: "lg" })}>
            <ArrowLeftIcon aria-hidden="true" /> Dashboard
          </Link>
        </div>
      </div>
    </section>
  )
}
