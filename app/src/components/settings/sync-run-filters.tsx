"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight } from "lucide-react";

export function SyncRunFilters() {
  const router = useRouter();
  const params = useSearchParams();
  function update(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    next.delete("page");
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    router.replace(`/settings${next.size ? `?${next}` : ""}`);
  }
  return <div className="flex flex-wrap items-end gap-3">
    <fieldset className="min-w-[min(100%,19rem)]">
      <legend className="text-sm font-medium">Date range</legend>
      <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
        <div><Label htmlFor="sync-start" className="sr-only">From</Label><Input id="sync-start" type="date" value={params.get("start") ?? ""} onChange={(event) => update({ start: event.target.value || null })} /></div>
        <ArrowRight aria-hidden className="mx-auto hidden size-4 text-muted-foreground sm:block" />
        <div><Label htmlFor="sync-end" className="sr-only">To</Label><Input id="sync-end" type="date" value={params.get("end") ?? ""} onChange={(event) => update({ end: event.target.value || null })} /></div>
      </div>
    </fieldset>
    {(params.get("start") || params.get("end")) && <Button variant="outline" onClick={() => router.replace("/settings")}>Reset</Button>}
  </div>;
}
