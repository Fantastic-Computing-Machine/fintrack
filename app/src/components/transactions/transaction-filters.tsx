"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Account } from "@/lib/types";
import { Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

export function TransactionFilters({ accounts }: { accounts: Account[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const [search, setSearch] = useState(params.get("search") ?? "");
  const update = useCallback(
    (changes: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      next.delete("cursor");
      next.delete("history");
      for (const [key, value] of Object.entries(changes)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      router.replace(`/transactions${next.size ? `?${next}` : ""}`);
    },
    [params, router],
  );
  useEffect(() => {
    const value = search.trim();
    if (value && value.length < 3) return;
    if ((params.get("search") ?? "") === value) return;
    const timer = window.setTimeout(
      () => update({ search: value || null }),
      300,
    );
    return () => window.clearTimeout(timer);
  }, [params, search, update]);
  return (
    <section className="grid gap-4 border-b pb-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-[minmax(180px,1fr)_190px_145px_145px_140px_120px_auto] 2xl:items-end">
      <div>
        <Label htmlFor="search">Search</Label>
        <div className="relative mt-2">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input
            id="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-9"
            placeholder="Search..."
          />
        </div>
      </div>
      <div>
        <Label htmlFor="account_id">Account</Label>
        <Select
          id="account_id"
          value={params.get("account_id") || null}
          onValueChange={(value) =>
            update({ account_id: value as string | null })
          }
          items={[
            { value: null, label: "All accounts" },
            ...accounts.map((account) => ({
              value: String(account.id),
              label: `${account.institution_name} · ${account.name}`,
            })),
          ]}
        >
          <SelectTrigger className="mt-2 w-full">
            <SelectValue placeholder="All accounts" />
          </SelectTrigger>
          <SelectContent className="w-[min(28rem,calc(100vw-2rem))]">
            <SelectItem value={null}>All accounts</SelectItem>
            {accounts.map((account) => (
              <SelectItem key={account.id} value={String(account.id)}>
                {account.institution_name} · {account.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="start">From</Label>
        <Input
          id="start"
          type="date"
          value={params.get("start") ?? ""}
          onChange={(event) => update({ start: event.target.value || null })}
          className="mt-2"
        />
      </div>
      <div>
        <Label htmlFor="end">To</Label>
        <Input
          id="end"
          type="date"
          value={params.get("end") ?? ""}
          onChange={(event) => update({ end: event.target.value || null })}
          className="mt-2"
        />
      </div>
      <div>
        <Label htmlFor="status">Status</Label>
        <Select
          id="status"
          value={params.get("status") || null}
          onValueChange={(value) => update({ status: value as string | null })}
          items={[
            { value: null, label: "All activity" },
            { value: "posted", label: "Posted" },
            { value: "pending", label: "Pending" },
          ]}
        >
          <SelectTrigger className="mt-2 w-full">
            <SelectValue placeholder="All activity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={null}>All activity</SelectItem>
            <SelectItem value="posted">Posted</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="limit">Rows</Label>
        <Select
          id="limit"
          value={params.get("limit") || "100"}
          onValueChange={(value) => update({ limit: value as string })}
          items={[
            { value: "100", label: "100 rows" },
            { value: "200", label: "200 rows" },
            { value: "500", label: "500 rows" },
          ]}
        >
          <SelectTrigger className="mt-2 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="100">100 rows</SelectItem>
            <SelectItem value="200">200 rows</SelectItem>
            <SelectItem value="500">500 rows</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button
        variant="outline"
        onClick={() => {
          setSearch("");
          router.replace("/transactions");
        }}
      >
        Reset
      </Button>
    </section>
  );
}
