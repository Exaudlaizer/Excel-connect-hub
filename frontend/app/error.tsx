"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

/**
 * Shown when a page crashes while rendering, instead of a blank screen.
 *
 * It deliberately shows nothing from the error itself: messages can name
 * internal code. The digest, if Next provides one, lets support find the
 * matching server log line.
 */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Stays in the browser console for whoever is debugging; not sent anywhere.
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto grid min-h-[70vh] max-w-lg place-items-center px-6 text-center">
      <div>
        <span className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-full bg-dangerSurface text-danger">
          <AlertTriangle size={26} aria-hidden />
        </span>
        <h1 className="text-heading text-ink">Something went wrong</h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          This page hit a problem. Your information is safe. Try again, and if it keeps happening, contact support
          {error.digest ? ` and quote reference ${error.digest}` : ""}.
        </p>
        <button type="button" onClick={reset} className="btn btn-primary focus-ring mt-6">
          <RefreshCw size={16} aria-hidden /> Try again
        </button>
      </div>
    </main>
  );
}
