"use client"

import { RotateCcwIcon } from "lucide-react"
import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import styles from "@/app/(store)/store-layout.module.css"

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[app-error]", error.digest ?? error.message)
  }, [error])

  return (
    <main className={styles.errorCenterMain}>
      <div>
        <h1 className={styles.statusPageTitle}>Something went wrong</h1>
        <p className={styles.statusPageLead}>Please try again. If it keeps happening, message us on WhatsApp.</p>
        <Button onClick={reset} size="lg" className={styles.errorRetryBtn}>
          <RotateCcwIcon aria-hidden="true" /> Try again
        </Button>
      </div>
    </main>
  )
}
