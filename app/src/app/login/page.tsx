"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Landmark } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { API_URL } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch(`${API_URL}/api/v1/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: data.get("password") }),
      });
      if (!response.ok) return setError("That password did not match.");
      router.push("/");
      router.refresh();
    } catch {
      setError("The API is unavailable. Check that it is running on port 8000.");
    } finally {
      setLoading(false);
    }
  }

  return <main className="grid min-h-screen lg:grid-cols-[1.15fr_.85fr]">
    <section className="hidden bg-foreground p-12 text-background lg:flex lg:flex-col lg:justify-between">
      <div className="flex items-center gap-2 font-semibold"><Landmark className="size-5" /> Fin Track</div>
      <div className="max-w-xl animate-rise"><p className="mb-5 font-mono text-xs uppercase tracking-[.2em] text-background/55">Private by design</p><h1 className="text-6xl font-medium leading-[1.02] tracking-[-.045em]">Every account.<br />One quiet ledger.</h1><p className="mt-7 max-w-md text-lg leading-8 text-background/65">Balances, card bills, and transactions—kept in infrastructure you control.</p></div>
      <p className="text-sm text-background/45">Single-owner access</p>
    </section>
    <section className="flex items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm animate-rise">
        <div className="mb-10 lg:hidden"><Landmark className="mb-4 size-7 text-primary" /><h1 className="text-3xl font-semibold">Fin Track</h1></div>
        <p className="font-mono text-xs uppercase tracking-[.18em] text-muted-foreground">Owner access</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight">Welcome back</h2>
        <p className="mt-2 text-muted-foreground">Enter your dashboard password.</p>
        <div className="mt-8 space-y-2"><Label htmlFor="password">Password</Label><Input id="password" name="password" type="password" autoComplete="current-password" required autoFocus /></div>
        {error && <Alert variant="destructive" className="mt-4"><AlertDescription>{error}</AlertDescription></Alert>}
        <Button type="submit" className="mt-6 w-full" disabled={loading}>{loading ? "Signing in…" : "Sign in"}</Button>
      </form>
    </section>
  </main>;
}
