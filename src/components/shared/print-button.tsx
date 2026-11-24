"use client"

import { PrinterIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import styles from "./shared.module.css"

/** Opens the browser print dialog (the customer can "Save as PDF" from there). */
export function PrintButton({ label = "Print / Save as PDF" }: { label?: string }) {
  return (
    <Button type="button" variant="outline" onClick={() => window.print()}>
      <PrinterIcon className={styles.icon16} /> {label}
    </Button>
  )
}
