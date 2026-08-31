"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { useEffect } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-[70vh] items-center justify-center px-4 py-16">
      <section role="alert" className="w-full max-w-lg rounded-2xl border border-border bg-card p-8 text-center shadow-sm sm:p-12">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <AlertTriangle className="size-5" aria-hidden="true" />
        </div>
        <p className="mt-6 font-mono text-xs uppercase tracking-[0.24em] text-muted-foreground">Error 500</p>
        <h1 className="mt-3 font-display text-3xl tracking-tight sm:text-4xl">We couldn’t load this view</h1>
        <p className="mx-auto mt-4 max-w-sm text-sm leading-6 text-muted-foreground">
          Something went wrong while loading your financial data. Try again, or return to the overview.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button onClick={() => reset()}>
            <RotateCcw className="size-4" aria-hidden="true" />
            Try again
          </Button>
          <Button variant="outline" render={<Link href="/" />}>
            Back to overview
          </Button>
        </div>
      </section>
    </main>
  );
}
