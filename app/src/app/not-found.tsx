import Link from "next/link";
import { ArrowLeft, SearchX } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-16">
      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-border bg-card/95 p-8 text-center shadow-sm backdrop-blur sm:p-12">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <SearchX className="size-5" aria-hidden="true" />
        </div>
        <p className="mt-6 font-mono text-xs uppercase tracking-[0.24em] text-muted-foreground">Error 404</p>
        <h1 className="mt-3 font-display text-4xl tracking-tight sm:text-5xl">Page not found</h1>
        <p className="mx-auto mt-4 max-w-sm text-sm leading-6 text-muted-foreground">
          The page you requested does not exist or may have moved.
        </p>
        <Link href="/" className={`${buttonVariants()} mt-8`}>
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to overview
        </Link>
      </div>
    </main>
  );
}
