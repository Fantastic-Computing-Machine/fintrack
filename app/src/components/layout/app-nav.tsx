import Link from "next/link";
import {
  ChartNoAxesCombined,
  Landmark,
  LayoutDashboard,
  ReceiptText,
  Settings,
} from "lucide-react";
import { LogoutButton } from "./logout-button";
import { buttonVariants } from "@/components/ui/button";

const links = [
  ["/", "Overview", LayoutDashboard],
  ["/transactions", "Transactions", ReceiptText],
  ["/insights", "Insights", ChartNoAxesCombined],
  ["/settings", "Settings", Settings],
] as const;

export function AppNav() {
  return (
    <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-3 sm:h-16 sm:px-5 lg:px-8">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 font-semibold tracking-tight"
        >
          <span className="grid size-8 place-items-center rounded-full bg-primary text-primary-foreground">
            <Landmark className="size-4" />
          </span>
          <span className="hidden sm:inline">Fin Track</span>
        </Link>
        <nav
          aria-label="Main navigation"
          className="ml-auto flex min-w-0 items-center gap-0.5 sm:gap-1"
        >
          {links.map(([href, label, Icon]) => (
            <Link
              key={href}
              aria-label={label}
              className={buttonVariants({
                variant: "ghost",
                size: "sm",
                className: "px-2 sm:px-2.5",
              })}
              href={href}
            >
              <Icon className="size-4" />
              <span className="hidden md:inline">{label}</span>
            </Link>
          ))}
          <LogoutButton />
        </nav>
      </div>
    </header>
  );
}
