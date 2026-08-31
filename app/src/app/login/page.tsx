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

  return <main className="relative z-10 grid min-h-screen overflow-hidden lg:grid-cols-[1.1fr_.9fr]">
    <div aria-hidden className="spectrum-edge absolute inset-x-0 top-0 h-1.5" />
    <section className="hidden p-12 lg:flex lg:flex-col lg:justify-between">
      <div className="flex items-center gap-2 font-semibold"><span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground"><Landmark /></span> Fin Track</div>
      <div className="max-w-xl animate-rise"><h1 className="font-display text-7xl leading-[.95] tracking-[-.065em]">A clearer view<br />of your money.</h1><p className="mt-7 max-w-md text-lg leading-8 text-muted-foreground">Balances, card bills, and transactions in one private place.</p></div>
      <p className="text-sm text-muted-foreground">Single-owner access</p>
    </section>
    <section className="flex items-center justify-center p-6 sm:p-10">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border bg-card p-6 shadow-sm animate-rise sm:p-8">
        <div className="mb-10"><span className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground"><Landmark /></span><h1 className="mt-4 text-2xl font-semibold">Fin Track</h1></div>
        <h2 className="font-display text-4xl tracking-[-.045em]">Welcome back</h2>
        <p className="mt-2 text-muted-foreground">Enter your dashboard password.</p>
        <div className="mt-8 space-y-2"><Label htmlFor="password">Password</Label><Input id="password" name="password" type="password" autoComplete="current-password" required autoFocus /></div>
        {error && <Alert variant="destructive" className="mt-4"><AlertDescription>{error}</AlertDescription></Alert>}
        <Button type="submit" className="mt-6 w-full" disabled={loading}>{loading ? "Signing in…" : "Sign in"}</Button>
      </form>
    </section>
  </main>;
}
