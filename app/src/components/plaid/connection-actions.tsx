"use client";
import { useCallback, useEffect, useState } from "react";
import { usePlaidLink, type PlaidLinkOnSuccess } from "react-plaid-link";
import { useRouter } from "next/navigation";
import { KeyRound, Link2, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { mutate } from "@/lib/api";

export function ConnectButton({ connectionId, label = "Connect institution" }: { connectionId?: number; label?: string } = {}) {
  const router = useRouter(); const [token, setToken] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const onSuccess = useCallback<PlaidLinkOnSuccess>(async (publicToken, metadata) => { setBusy(true); if (connectionId) await mutate("/sync", "POST", { connection_id: connectionId }); else if (publicToken) await mutate("/plaid/exchange", "POST", { public_token: publicToken, institution_id: metadata.institution?.institution_id, institution_name: metadata.institution?.name ?? "Institution" }); setBusy(false); router.refresh(); }, [connectionId, router]);
  const { open, ready } = usePlaidLink({ token, onSuccess });
  async function connect() { setBusy(true); const data = await mutate("/plaid/link-token", "POST", { connection_id: connectionId }); setToken(data.link_token); setBusy(false); }
  useEffect(() => { if (token && ready) open(); }, [token, ready, open]);
  return <Button onClick={connect} disabled={busy}><Link2 className="size-4" />{busy ? "Connecting…" : label}</Button>;
}

export function RotateTokenButton({ id }: { id: number }) {
  const router = useRouter(); const [busy, setBusy] = useState(false);
  return <Button variant="outline" size="sm" disabled={busy} onClick={async () => { setBusy(true); try { await mutate(`/connections/${id}/rotate-token`); toast.success("Token rotated"); router.refresh(); } catch { toast.error("Could not rotate token"); } finally { setBusy(false); } }}><KeyRound className="size-4" />Rotate token</Button>;
}

export function RefreshButton() {
  const router = useRouter(); const [busy, setBusy] = useState(false);
  return <Button variant="outline" disabled={busy} onClick={async () => { setBusy(true); try { await mutate("/sync", "POST", {}); toast.success("Refresh queued"); setTimeout(() => { setBusy(false); router.refresh(); }, 1200); } catch { setBusy(false); toast.error("Could not queue refresh"); } }}><RefreshCw className={`size-4 ${busy ? "animate-spin" : ""}`} />{busy ? "Refreshing…" : "Refresh all"}</Button>;
}

export function DisconnectButton({ id, name }: { id: number; name: string }) {
  const router = useRouter(); const [busy, setBusy] = useState(false);
  return <AlertDialog><AlertDialogTrigger render={<Button variant="ghost" size="sm" disabled={busy} aria-label={`Disconnect ${name}`} />}><Trash2 className="size-4" />Disconnect</AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Disconnect {name}?</AlertDialogTitle><AlertDialogDescription>Future access will be revoked. Previously imported history stays in your database.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={async () => { setBusy(true); await mutate(`/connections/${id}`, "DELETE"); router.refresh(); }}>Disconnect</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>;
}
