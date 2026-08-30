import { AlertCircle, CheckCircle2, CircleDashed } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConnectButton, DisconnectButton, RefreshButton, RotateTokenButton } from "@/components/plaid/connection-actions";
import { shortDate } from "@/lib/api";
import { api } from "@/lib/api-server";
import type { Connection, SyncRun } from "@/lib/types";

export const dynamic = "force-dynamic";

function ConnectionRow({ connection }: { connection: Connection }) {
  const disconnected = connection.status === "disconnected";
  const active = connection.status === "active";
  return <div className="flex flex-col justify-between gap-4 py-6 sm:flex-row sm:items-center">
    <div className="flex items-start gap-3">
      {active ? <CheckCircle2 className="mt-0.5 size-5 text-primary" /> : disconnected ? <CircleDashed className="mt-0.5 size-5 text-muted-foreground" /> : <AlertCircle className="mt-0.5 size-5 text-destructive" />}
      <div>
        <div className="flex items-center gap-2"><p className="font-semibold">{connection.institution_name}</p><Badge variant={active ? "secondary" : disconnected ? "outline" : "destructive"}>{connection.status}</Badge></div>
        {disconnected ? <p className="mt-1 text-sm text-muted-foreground">Access revoked. Imported history is retained.</p> : <><p className="mt-1 text-sm text-muted-foreground">Last successful sync: {shortDate(connection.last_success_at)}</p>{connection.last_error && <p className="mt-1 text-sm text-destructive">{connection.last_error}</p>}</>}
      </div>
    </div>
    {!disconnected && <div className="flex gap-2">{connection.status === "reconnect_required" && <ConnectButton connectionId={connection.id} label="Reconnect" />}<RotateTokenButton id={connection.id} /><DisconnectButton id={connection.id} name={connection.institution_name} /></div>}
  </div>;
}

export default async function SettingsPage() {
  const [connections, runs] = await Promise.all([api<Connection[]>("/connections"), api<SyncRun[]>("/sync-runs")]);
  const connected = connections.filter(connection => connection.status !== "disconnected");
  const disconnected = connections.filter(connection => connection.status === "disconnected");
  return <div className="space-y-12 animate-rise">
    <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
      <div><p className="font-mono text-xs uppercase tracking-[.18em] text-muted-foreground">Data sources</p><h1 className="mt-2 text-4xl font-semibold tracking-[-.035em]">Settings</h1><p className="mt-2 text-muted-foreground">Manage access and review provider freshness.</p></div>
      <div className="flex gap-2"><RefreshButton /><ConnectButton /></div>
    </div>
    <Alert><AlertCircle className="size-4" /><AlertTitle>Provider data is read-only</AlertTitle><AlertDescription>Disconnecting revokes future access. Previously imported history remains in your database.</AlertDescription></Alert>
    <section>
      <div className="mb-5 flex items-center justify-between"><div><h2 className="text-xl font-semibold">Connected institutions</h2><p className="mt-1 text-sm text-muted-foreground">Accounts shown on your dashboard.</p></div><span className="text-sm text-muted-foreground">{connected.length} active</span></div>
      <div className="divide-y border-y">{connected.length ? connected.map(connection => <ConnectionRow key={connection.id} connection={connection} />) : <p className="py-12 text-center text-muted-foreground">No institutions connected yet.</p>}</div>
    </section>
    {disconnected.length > 0 && <details className="group rounded-lg border bg-card"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-medium outline-none marker:content-none focus-visible:ring-2 focus-visible:ring-ring"><span>Disconnected history</span><span className="text-sm font-normal text-muted-foreground">{disconnected.length} {disconnected.length === 1 ? "institution" : "institutions"} · <span className="group-open:hidden">Show</span><span className="hidden group-open:inline">Hide</span></span></summary><div className="divide-y border-t px-5">{disconnected.map(connection => <ConnectionRow key={connection.id} connection={connection} />)}</div></details>}
    <section>
      <div className="mb-5"><h2 className="text-xl font-semibold">Recent syncs</h2><p className="mt-1 text-sm text-muted-foreground">The latest provider import attempts.</p></div>
      <div className="overflow-hidden rounded-lg border bg-card"><Table><TableHeader><TableRow><TableHead>Started</TableHead><TableHead>Trigger</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Changes</TableHead></TableRow></TableHeader><TableBody>{runs.length ? runs.map(run => <TableRow key={run.id}><TableCell>{shortDate(run.started_at)}</TableCell><TableCell className="capitalize">{run.trigger}</TableCell><TableCell><span className="flex items-center gap-2">{run.status === "running" && <CircleDashed className="size-4 animate-spin" />}{run.status}</span></TableCell><TableCell className="text-right font-mono">+{run.added_count} · {run.modified_count} changed · {run.removed_count} removed</TableCell></TableRow>) : <TableRow><TableCell colSpan={4} className="h-28 text-center text-muted-foreground">No synchronization history.</TableCell></TableRow>}</TableBody></Table></div>
    </section>
  </div>;
}
