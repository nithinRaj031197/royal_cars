"use client";

/**
 * Last-resort boundary, for errors thrown above the app's own error.tsx —
 * including in the root layout itself. Without it, a failure there renders
 * Next's bare "Application error: a server-side exception has occurred" with no
 * branding and no way back.
 *
 * It must render its own <html> and <body>, because the root layout is exactly
 * what may have failed.
 */
export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#0a0a0b", color: "#e2e8f0" }}>
        <main style={{ maxWidth: "32rem", margin: "0 auto", padding: "6rem 1.5rem" }}>
          <div
            style={{
              display: "grid",
              placeItems: "center",
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "#dc2626",
              color: "white",
              fontWeight: 700,
              fontSize: 14
            }}
          >
            RC
          </div>
          <h1 style={{ marginTop: "1.5rem", fontSize: "1.5rem", fontWeight: 600 }}>Royal Cars could not start</h1>
          <p style={{ marginTop: "0.75rem", lineHeight: 1.6, color: "#94a3b8" }}>
            The server hit an error before the page could render. This is usually a missing or
            malformed environment variable rather than a problem with your data.
          </p>
          {error.digest ? (
            <p style={{ marginTop: "1rem", fontSize: "0.8rem", color: "#64748b" }}>
              Reference <code style={{ fontFamily: "ui-monospace, monospace" }}>{error.digest}</code> — quote this
              when checking the server logs.
            </p>
          ) : null}
          <button
            onClick={reset}
            style={{
              marginTop: "1.5rem",
              padding: "0.6rem 1rem",
              borderRadius: 8,
              border: "1px solid #334155",
              background: "#dc2626",
              color: "white",
              fontSize: "0.9rem",
              cursor: "pointer"
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
