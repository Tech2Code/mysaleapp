"use client"

// Last-resort boundary: renders when the root layout itself fails (settings/DB outage, provider crash).
// It replaces the whole document, so it must not depend on the theme, fonts or any provider.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en-IN">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#fbf7f2", color: "#1f1a17" }}>
        <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 16, textAlign: "center" }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 600, margin: 0 }}>Something went wrong</h1>
            <p style={{ marginTop: 8, color: "#6b625b" }}>Please try again. If it keeps happening, message us on WhatsApp.</p>
            <button
              type="button"
              onClick={reset}
              style={{ marginTop: 24, height: 44, padding: "0 24px", borderRadius: 999, border: 0, background: "#b85c38", color: "#fff", fontSize: 16, cursor: "pointer" }}
            >
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  )
}
