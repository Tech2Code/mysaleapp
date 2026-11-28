"use client"

import { useEffect } from "react"

// Last-resort boundary: renders when the root layout itself fails (settings/DB outage, provider crash).
// It replaces the whole document, so it must not depend on the theme, fonts or any provider.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[global-error]", error.digest ?? error.message)
  }, [error])

  return (
    <html lang="en-IN">
      <head>
        <style>{`
          body { margin: 0; font-family: system-ui, sans-serif; background: #fbf7f2; color: #1f1a17; }
          .ge-sub { margin-top: 8px; color: #6b625b; }
          @media (prefers-color-scheme: dark) {
            body { background: #141210; color: #f5f0eb; }
            .ge-sub { color: #a89f96; }
          }
        `}</style>
      </head>
      <body>
        <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 16, textAlign: "center" }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 600, margin: 0 }}>Something went wrong</h1>
            <p className="ge-sub">Please try again. If it keeps happening, message us on WhatsApp.</p>
            <button
              type="button"
              onClick={reset}
              style={{ marginTop: 24, height: 44, padding: "0 24px", borderRadius: 12, border: 0, background: "#b85c38", color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer" }}
            >
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  )
}
