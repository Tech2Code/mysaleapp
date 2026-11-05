"use client"

import { RotateCcwIcon } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main data-ui="error:/" className="grid min-h-[70dvh] place-items-center px-4 text-center">
      <div data-ui="error://div">
        <h1 data-ui="error://h1-something-went-wrong" className="text-3xl font-semibold">Something went wrong</h1>
        <p data-ui="error://p" className="mt-2 text-muted-foreground">Please try again. If it keeps happening, message us on WhatsApp.</p>
        <Button data-ui="error://Button-try-again" onClick={reset} size="lg" className="mt-6 rounded-full px-6">
          <RotateCcwIcon /> Try again
        </Button>
      </div>
    </main>
  )
}
