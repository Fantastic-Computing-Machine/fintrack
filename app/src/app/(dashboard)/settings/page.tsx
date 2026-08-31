import Link from "next/link";
import {
  ConnectButton,
  DisconnectButton,
  RefreshButton,
  RotateTokenButton,
} from "@/components/plaid/connection-actions";
import { DashboardPreferenceSelect } from "@/components/settings/dashboard-preference";
import { SyncRunFilters } from "@/components/settings/sync-run-filters";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { shortDate, shortDateTime } from "@/lib/api";
import { api } from "@/lib/api-server";
import type { Connection, DashboardPreference, SyncRunPage } from "@/lib/types";
import { AlertCircle, CheckCircle2, CircleDashed } from "lucide-react";

export const dynamic = "force-dynamic";

function ConnectionRow({ connection }: { connection: Connection }) {
  const disconnected = connection.status === "disconnected";
  const active = connection.status === "active";
  return (
    <div className="flex flex-col justify-between gap-3 px-5 py-4 sm:flex-row sm:items-center sm:px-6">
      <div className="flex items-start gap-3">
        {active ? (
          <CheckCircle2 className="mt-0.5 size-5 text-primary" />
        ) : disconnected ? (
          <CircleDashed className="mt-0.5 size-5 text-muted-foreground" />
        ) : (
          <AlertCircle className="mt-0.5 size-5 text-destructive" />
        )}
        <div>
          <div className="flex items-center gap-2">
            <p className="font-semibold">{connection.institution_name}</p>
            <Badge
              variant={
                active ? "secondary" : disconnected ? "outline" : "destructive"
              }
            >
              {connection.status}
            </Badge>
          </div>
          {disconnected ? (
            <p className="mt-1 text-sm text-muted-foreground">
              Access revoked. Imported history is retained.
            </p>
          ) : (
            <>
              <p className="mt-1 text-sm text-muted-foreground">
                Last successful sync: {shortDate(connection.last_success_at)}
              </p>
              {connection.last_error && (
                <p className="mt-1 text-sm text-destructive">
                  {connection.last_error}
                </p>
              )}
            </>
          )}
        </div>
      </div>
      {!disconnected && (
      <div className="flex flex-wrap gap-2">
          {connection.status === "reconnect_required" && (
            <ConnectButton connectionId={connection.id} label="Reconnect" />
          )}
          <RotateTokenButton id={connection.id} />
          <DisconnectButton
            id={connection.id}
            name={connection.institution_name}
          />
        </div>
      )}
    </div>
  );
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const syncQuery = new URLSearchParams();
  const syncPage = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  if (params.start) syncQuery.set("start", params.start);
  if (params.end) syncQuery.set("end", params.end);
  if (syncPage > 1) syncQuery.set("page", String(syncPage));
  const [connections, runs, preference] = await Promise.all([
    api<Connection[]>("/connections"),
    api<SyncRunPage>(`/sync-runs?${syncQuery}`),
    api<DashboardPreference>("/dashboard-preferences"),
  ]);
  const connected = connections.filter(
    (connection) => connection.status !== "disconnected",
  );
  const disconnected = connections.filter(
    (connection) => connection.status === "disconnected",
  );
  const syncPageHref = (page: number) => {
    const query = new URLSearchParams();
    if (params.start) query.set("start", params.start);
    if (params.end) query.set("end", params.end);
    if (page > 1) query.set("page", String(page));
    return `/settings${query.size ? `?${query}` : ""}`;
  };
  return (
    <div className="space-y-8 animate-rise">
      <div className="relative overflow-hidden rounded-2xl border bg-card p-5 shadow-sm sm:p-7">
        <div aria-hidden className="spectrum-edge absolute inset-x-0 top-0 h-1" />
        <div>
            <h1 className="font-display text-4xl tracking-[-.045em] sm:text-5xl">
            Settings
          </h1>
          <p className="mt-2 text-muted-foreground">
            Manage access and review provider freshness.
          </p>
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          <RefreshButton />
          <ConnectButton />
        </div>
      </div>
      <Alert>
        <AlertCircle className="size-4" />
        <AlertTitle>Provider data is read-only</AlertTitle>
        <AlertDescription>
          Disconnecting revokes future access. Previously imported history
          remains in your database.
        </AlertDescription>
      </Alert>
      <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Connected institutions</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Accounts shown on your dashboard.
            </p>
          </div>
          <span className="text-sm text-muted-foreground">
            {connected.length} active
          </span>
        </div>
        <div className="divide-y overflow-hidden rounded-xl border">
          {connected.length ? (
            connected.map((connection) => (
              <ConnectionRow key={connection.id} connection={connection} />
            ))
          ) : (
            <p className="py-12 text-center text-muted-foreground">
              No institutions connected yet.
            </p>
          )}
        </div>
      </section>
      <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-xl font-semibold">Overview layout</h2>
            <p className="mt-1 text-sm text-muted-foreground">Choose how account balances are grouped on Overview.</p>
          </div>
          <DashboardPreferenceSelect preference={preference} />
        </div>
      </section>
      {disconnected.length > 0 && (
        <details className="group w-full rounded-2xl border bg-card shadow-sm">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-3 font-medium outline-none marker:content-none focus-visible:ring-2 focus-visible:ring-ring">
            <span>Disconnected history</span>
            <span className="text-sm font-normal text-muted-foreground">
              {disconnected.length}{" "}
              {disconnected.length === 1 ? "institution" : "institutions"} ·{" "}
              <span className="group-open:hidden">Show</span>
              <span className="hidden group-open:inline">Hide</span>
            </span>
          </summary>
          <div data-slot="disclosure-content">
            <div className="divide-y border-t">
              {disconnected.map((connection) => (
                <ConnectionRow key={connection.id} connection={connection} />
              ))}
            </div>
          </div>
        </details>
      )}
      <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
        <div className="mb-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h2 className="text-xl font-semibold">Recent syncs</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              The latest provider import attempts.
            </p>
          </div>
          <SyncRunFilters />
        </div>
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Started</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Changes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.items.length ? (
                runs.items.map((run) => (
                  <TableRow key={run.id}>
                    <TableCell>{shortDateTime(run.started_at)}</TableCell>
                    <TableCell className="capitalize">{run.trigger}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-2">
                        {run.status === "running" && (
                          <CircleDashed className="size-4 animate-spin" />
                        )}
                        {run.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      +{run.added_count} · {run.modified_count} changed ·{" "}
                      {run.removed_count} removed
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="h-28 text-center text-muted-foreground"
                  >
                    No synchronization history.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        {runs.total > 100 && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Page {runs.page} of {Math.ceil(runs.total / 100)} · {runs.total} syncs
            </p>
            <div className="flex gap-2">
              {runs.page > 1 && <Link className={buttonVariants({ variant: "outline" })} href={syncPageHref(runs.page - 1)}>Previous</Link>}
              {runs.page * 100 < runs.total && <Link className={buttonVariants({ variant: "outline" })} href={syncPageHref(runs.page + 1)}>Next</Link>}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
