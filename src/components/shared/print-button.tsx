"use client"

import { PrinterIcon } from "lucide-react"
import { Button } from "@/components/ui/button"

/** Opens the browser print dialog (the customer can "Save as PDF" from there). */
export function PrintButton({ label = "Print / Save as PDF" }: { label?: string }) {
  return (
    <Button data-ui="shared/PrintButton" type="button" variant="outline" onClick={() => window.print()}>
      <PrinterIcon className="size-4" /> {label}
    </Button>
  )
}
