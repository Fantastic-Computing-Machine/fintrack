"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import "./globals.css";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <head>
        <title>Fin Track — Something went wrong</title>
      </head>
      <body className="min-h-screen bg-background text-foreground">
        <main className="flex min-h-screen items-center justify-center px-6 py-16">
          <section role="alert" className="w-full max-w-lg rounded-2xl border border-border bg-card p-8 text-center shadow-sm sm:p-12">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <AlertTriangle className="size-5" aria-hidden="true" />
            </div>
            <p className="mt-6 font-mono text-xs uppercase tracking-[0.24em] text-muted-foreground">Error 500</p>
            <h1 className="mt-3 text-3xl tracking-tight sm:text-4xl">Fin Track needs a moment</h1>
            <p className="mx-auto mt-4 max-w-sm text-sm leading-6 text-muted-foreground">
              An unexpected error interrupted the application. Refresh to try again.
            </p>
            <button
              type="button"
              onClick={() => reset()}
              className="mt-8 inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <RotateCcw className="size-4" aria-hidden="true" />
              Try again
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
