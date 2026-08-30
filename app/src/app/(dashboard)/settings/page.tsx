import { AlertCircle, CheckCircle2, CircleDashed } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ConnectButton,
  DisconnectButton,
  RefreshButton,
  RotateTokenButton,
} from "@/components/plaid/connection-actions";
import { shortDate, shortDateTime } from "@/lib/api";
import { api } from "@/lib/api-server";
import { DashboardPreferenceSelect } from "@/components/settings/dashboard-preference";
import { SyncRunFilters } from "@/components/settings/sync-run-filters";
import type { Connection, DashboardPreference, SyncRun } from "@/lib/types";

export const dynamic = "force-dynamic";

function ConnectionRow({ connection }: { connection: Connection }) {
  const disconnected = connection.status === "disconnected";
  const active = connection.status === "active";
  return (
    <div className="flex flex-col justify-between gap-3 py-4 sm:flex-row sm:items-center">
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
  if (params.start) syncQuery.set("start", params.start);
  if (params.end) syncQuery.set("end", params.end);
  const [connections, runs, preference] = await Promise.all([
    api<Connection[]>("/connections"),
    api<SyncRun[]>(`/sync-runs?${syncQuery}`),
    api<DashboardPreference>("/dashboard-preferences"),
  ]);
  const connected = connections.filter(
    (connection) => connection.status !== "disconnected",
  );
  const disconnected = connections.filter(
    (connection) => connection.status === "disconnected",
  );
  return (
    <div className="space-y-8 animate-rise">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="font-mono text-xs uppercase tracking-[.18em] text-muted-foreground">
            Data sources
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-.035em] sm:text-4xl">
            Settings
          </h1>
          <p className="mt-2 text-muted-foreground">
            Manage access and review provider freshness.
          </p>
        </div>
        <div className="flex gap-2">
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
      <section>
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
        <div className="divide-y border-y">
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
      <section className="border-y py-4">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-xl font-semibold">Overview layout</h2>
            <p className="mt-1 text-sm text-muted-foreground">Choose how account balances are grouped on Overview.</p>
          </div>
          <DashboardPreferenceSelect preference={preference} />
        </div>
      </section>
      {disconnected.length > 0 && (
        <details className="group w-full rounded-lg border bg-card">
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
            <div className="divide-y border-t px-5">
              {disconnected.map((connection) => (
                <ConnectionRow key={connection.id} connection={connection} />
              ))}
            </div>
          </div>
        </details>
      )}
      <section>
        <div className="mb-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h2 className="text-xl font-semibold">Recent syncs</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              The latest provider import attempts.
            </p>
          </div>
          <SyncRunFilters />
        </div>
        <div className="overflow-x-auto rounded-lg border bg-card">
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
              {runs.length ? (
                runs.map((run) => (
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
      </section>
    </div>
  );
}
