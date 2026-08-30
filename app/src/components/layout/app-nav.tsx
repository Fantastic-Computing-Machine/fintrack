import Link from "next/link";
import { Landmark } from "lucide-react";
import { LogoutButton } from "./logout-button";
import { buttonVariants } from "@/components/ui/button";

export function AppNav() {
  return <header className="border-b bg-background/85 backdrop-blur-xl sticky top-0 z-30"><div className="mx-auto flex h-16 max-w-7xl items-center px-5 lg:px-8"><Link href="/" className="flex items-center gap-2 font-semibold tracking-tight"><span className="grid size-8 place-items-center rounded-full bg-primary text-primary-foreground"><Landmark className="size-4" /></span>Fin Track</Link><nav aria-label="Main navigation" className="ml-auto flex items-center gap-1"><Link className={buttonVariants({ variant: "ghost" })} href="/">Overview</Link><Link className={buttonVariants({ variant: "ghost" })} href="/transactions">Transactions</Link><Link className={buttonVariants({ variant: "ghost" })} href="/settings">Settings</Link><LogoutButton /></nav></div></header>;
}
