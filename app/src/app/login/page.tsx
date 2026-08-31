"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { API_URL } from "@/lib/api";
import { Landmark } from "lucide-react";
import { useRouter } from "next/navigation";
import { SubmitEvent, useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: SubmitEvent<HTMLFormElement>) {
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

  return (
    <main className="relative z-10 flex min-h-screen flex-col overflow-hidden lg:grid lg:grid-cols-[1.1fr_.9fr]">
      <div aria-hidden className="spectrum-edge absolute inset-x-0 top-0 h-1.5" />
      <section className="hidden p-12 lg:flex lg:flex-col">
        <Brand />
        <div className="flex flex-1 items-center justify-center text-center">
          <Intro />
        </div>
      </section>
      <section className="p-6 pb-0 sm:p-10 sm:pb-0 lg:hidden">
        <Brand />
        <Intro compact />
      </section>
      <section className="flex flex-1 items-center justify-center p-6 sm:px-10 lg:p-10">
        <form
          onSubmit={submit}
          className="w-full max-w-sm animate-rise lg:rounded-2xl lg:border lg:bg-card lg:p-8 lg:shadow-sm"
        >
          <div className="mb-10 hidden lg:block">
            <span className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground">
              <Landmark />
            </span>
            <h1 className="mt-4 text-2xl font-semibold">Fin Track</h1>
          </div>
          <h2 className="font-display text-4xl tracking-[-.045em]">Welcome back</h2>
          <div className="mt-8 space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" autoComplete="current-password" required autoFocus />
          </div>
          {error && <Alert variant="destructive" className="mt-4"><AlertDescription>{error}</AlertDescription></Alert>}
          <Button type="submit" className="mt-6 w-full" disabled={loading}>{loading ? "Signing in…" : "Sign in"}</Button>
        </form>
      </section>
    </main>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2 font-semibold">
      <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
        <Landmark />
      </span>
      Fin Track
    </div>
  );
}

function Intro({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? "mt-14 max-w-md animate-rise" : "max-w-xl animate-rise"}>
      <h1 className={compact ? "font-display text-5xl leading-[.95] tracking-[-.065em]" : "font-display text-7xl leading-[.95] tracking-[-.065em]"}>
        A clearer view<br />of your money.
      </h1>
      <p className="mt-7 max-w-md text-lg leading-8 text-muted-foreground">
        Balances, card bills, and transactions in one private place.
      </p>
    </div>
  );
}
