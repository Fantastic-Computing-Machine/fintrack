"use client";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { mutate } from "@/lib/api";

export function LogoutButton() {
  const router = useRouter();
  return <Button variant="outline" className="w-full" aria-label="Log out" onClick={async () => { await mutate("/auth/logout"); router.push("/login"); router.refresh(); }}><LogOut className="size-4" />Log out</Button>;
}
