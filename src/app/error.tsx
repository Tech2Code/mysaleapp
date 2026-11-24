"use client"

import { RotateCcwIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import styles from "@/app/(store)/store-layout.module.css"

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className={styles.errorCenterMain}>
      <div>
        <h1 className={styles.statusPageTitle}>Something went wrong</h1>
        <p className={styles.statusPageLead}>Please try again. If it keeps happening, message us on WhatsApp.</p>
        <Button onClick={reset} size="lg" className={styles.errorRetryBtn}>
          <RotateCcwIcon /> Try again
        </Button>
      </div>
    </main>
  )
}
