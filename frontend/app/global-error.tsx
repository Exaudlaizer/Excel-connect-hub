"use client";

/**
 * Last-resort screen for a crash in the root layout itself. The layout (and its
 * stylesheet and providers) may be what failed, so this renders its own <html>
 * and styles inline, with no dependency on anything else in the app.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#0b0d11", color: "#f2f4f8" }}>
        <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, textAlign: "center" }}>
          <div style={{ maxWidth: 420 }}>
            <h1 style={{ fontSize: 24, margin: "0 0 8px" }}>Something went wrong</h1>
            <p style={{ margin: "0 0 20px", lineHeight: 1.6, color: "#aab1bf" }}>
              Excel Connect Hub hit a problem loading this page. Please try again
              {error.digest ? ` (reference ${error.digest})` : ""}.
            </p>
            <button
              type="button"
              onClick={reset}
              style={{ padding: "10px 18px", borderRadius: 8, border: 0, background: "#3b82f6", color: "#fff", fontSize: 15, cursor: "pointer" }}
            >
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
