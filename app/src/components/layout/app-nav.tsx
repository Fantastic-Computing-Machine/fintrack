"use client";

import { RefreshButton } from "@/components/plaid/connection-actions";
import { buttonVariants } from "@/components/ui/button";
import {
  dashboardNavigation,
  isDashboardPath,
} from "@/lib/dashboard-navigation.mjs";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import {
  ChartNoAxesCombined,
  Landmark,
  LayoutDashboard,
  ReceiptText,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "./logout-button";

const icons: Record<string, LucideIcon> = {
  Overview: LayoutDashboard,
  Transactions: ReceiptText,
  Insights: ChartNoAxesCombined,
  Settings,
};

export function AppNav() {
  const pathname = usePathname();

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar px-4 py-5 lg:flex">
        <Link
          href="/"
          className="flex items-center gap-3 px-2 font-semibold tracking-tight"
        >
          <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Landmark />
          </span>
          <span className="text-lg">Fin Track</span>
        </Link>
        <nav
          aria-label="Main navigation"
          className="mt-10 flex flex-col gap-1"
        >
          {dashboardNavigation.map(({ href, label }) => {
            const Icon = icons[label];
            const active = isDashboardPath(pathname, href);
            return (
            <Link
              key={href}
                aria-current={active ? "page" : undefined}
              className={buttonVariants({
                variant: active ? "secondary" : "ghost",
                className: "h-10 justify-start gap-3 px-3",
              })}
              href={href}
            >
                <Icon data-icon="inline-start" />
                {label}
            </Link>
            );
          })}
        </nav>
        <div className="mt-auto flex flex-col gap-4 border-t pt-5">
          <RefreshButton />
          <LogoutButton />
        </div>
      </aside>

      <nav
        aria-label="Mobile navigation"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t bg-sidebar/95 px-2 pb-[max(.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur lg:hidden"
      >
        {dashboardNavigation.map(({ href, label }) => {
          const Icon = icons[label];
          const active = isDashboardPath(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg text-xs font-medium transition-colors",
                active
                  ? "bg-secondary text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon />
              {label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
