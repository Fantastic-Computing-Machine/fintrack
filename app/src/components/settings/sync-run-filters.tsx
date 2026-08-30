"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SyncRunFilters() {
  const router = useRouter();
  const params = useSearchParams();
  function update(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    router.replace(`/settings${next.size ? `?${next}` : ""}`);
  }
  return <div className="flex flex-wrap items-end gap-3">
    <div><Label htmlFor="sync-start">From</Label><Input id="sync-start" type="date" value={params.get("start") ?? ""} onChange={(event) => update({ start: event.target.value || null })} className="mt-2 w-36" /></div>
    <div><Label htmlFor="sync-end">To</Label><Input id="sync-end" type="date" value={params.get("end") ?? ""} onChange={(event) => update({ end: event.target.value || null })} className="mt-2 w-36" /></div>
    {(params.get("start") || params.get("end")) && <Button variant="outline" onClick={() => router.replace("/settings")}>Reset</Button>}
  </div>;
}
