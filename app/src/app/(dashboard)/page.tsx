import Link from "next/link";
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  ChevronRight,
  Clock3,
} from "lucide-react";
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
import { money, shortDate } from "@/lib/api";
import { api } from "@/lib/api-server";
import type { Account, Card, Summary } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Overview() {
  const [summary, accounts, cards] = await Promise.all([
    api<Summary>("/summary"),
    api<Account[]>("/accounts"),
    api<Card[]>("/cards"),
  ]);
  return (
    <div className="space-y-14 animate-rise">
      <section>
        <div className="flex items-end justify-between gap-8">
          <div>
            <p className="font-mono text-xs uppercase tracking-[.18em] text-muted-foreground">
              Net position
            </p>
            <h1 className="mt-3 break-words text-4xl font-medium tracking-[-.045em] sm:text-7xl">
              {money(summary.net_position)}
            </h1>
          </div>
          <div className="hidden text-right text-sm text-muted-foreground sm:block">
            <p>Last sync</p>
            <p className="mt-1 text-foreground">
              {summary.last_success_at
                ? shortDate(summary.last_success_at)
                : "Never"}
            </p>
          </div>
        </div>
        <div className="mt-10 grid gap-8 border-y py-6 sm:grid-cols-2">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ArrowUpRight className="size-4 text-primary" /> Cash
            </div>
            <p className="mt-2 text-2xl font-semibold">{money(summary.cash)}</p>
          </div>
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ArrowDownRight className="size-4" /> Card debt
            </div>
            <p className="mt-2 text-2xl font-semibold">
              {money(summary.credit_card_debt)}
            </p>
          </div>
        </div>
      </section>
      {(summary.error_count > 0 || summary.stale_count > 0) && (
        <Alert>
          <AlertCircle className="size-4" />
          <AlertTitle>Some data needs attention</AlertTitle>
          <AlertDescription>
            {summary.error_count} connection errors · {summary.stale_count}{" "}
            stale connections. Review Settings for details.
          </AlertDescription>
        </Alert>
      )}
      <section>
        <div className="mb-5 flex items-end justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[.18em] text-muted-foreground">
              Balances
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              Accounts
            </h2>
          </div>
          <span className="text-sm text-muted-foreground">
            {accounts.length} accounts
          </span>
        </div>
        <div className="overflow-x-auto rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Institution / account</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Available</TableHead>
                <TableHead className="text-right">Current</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.length ? (
                accounts.map((account) => (
                  <TableRow key={account.id} className="group">
                    <TableCell>
                      <Link
                        href={`/accounts/${account.id}`}
                        className="flex items-center gap-2 rounded-sm font-medium outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <span>
                          {account.name}{" "}
                          {account.mask && (
                            <span className="text-muted-foreground">
                              ··{account.mask}
                            </span>
                          )}
                        </span>
                        <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {account.institution_name}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className="font-normal capitalize"
                      >
                        {account.subtype?.replaceAll("_", " ") ?? account.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {money(account.available_balance, account.currency)}
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium">
                      {money(account.current_balance, account.currency)}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="h-28 text-center text-muted-foreground"
                  >
                    Connect your first institution in Settings.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>
      <section>
        <div className="mb-6">
          <p className="font-mono text-xs uppercase tracking-[.18em] text-muted-foreground">
            Obligations
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">
            Card bills
          </h2>
        </div>
        {cards.length ? (
          <div className="divide-y border-y">
            {cards.map((card) => (
              <article
                key={card.account_id}
                className="grid gap-5 py-7 md:grid-cols-[1.4fr_repeat(3,1fr)] md:items-center"
              >
                <div>
                  <Link
                    href={`/accounts/${card.account_id}`}
                    className="inline-flex items-center gap-1 rounded-sm font-semibold outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {card.account_name}{" "}
                    {card.mask && (
                      <span className="font-normal text-muted-foreground">
                        ··{card.mask}
                      </span>
                    )}
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </Link>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {card.institution_name}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    Current balance
                  </p>
                  <p className="mt-1 font-mono font-medium">
                    {money(card.current_balance)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Minimum due</p>
                  <p className="mt-1 font-mono font-medium">
                    {money(card.minimum_payment)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Due date</p>
                  <p className="mt-1 flex items-center gap-2 font-medium">
                    <Clock3 className="size-4 text-muted-foreground" />{" "}
                    {shortDate(card.next_payment_due_date)}
                  </p>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="border-y py-12 text-center text-muted-foreground">
            No credit-card accounts are available.
          </p>
        )}
      </section>
    </div>
  );
}
