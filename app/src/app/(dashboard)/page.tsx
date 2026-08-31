import Link from "next/link";
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  ChevronRight,
  Clock3,
  Landmark,
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
import { OverviewPrivacy, PrivateAmount, PrivacyToggle } from "@/components/overview/overview-privacy";
import type { Account, Card, DashboardPreference, Loan, Summary } from "@/lib/types";

export const dynamic = "force-dynamic";

function groupLabel(account: Account, grouping: "institution" | "account_type") {
  if (grouping === "institution") return account.institution_name;
  return (account.subtype ?? account.type).replaceAll("_", " ");
}

function total(accounts: Account[], key: "current_balance" | "available_balance") {
  const values = accounts.map((account) => account[key]).filter((value): value is string => value !== null);
  return values.length ? money(String(values.reduce((sum, value) => sum + Number(value), 0)), accounts[0].currency) : "Unavailable";
}

export default async function Overview() {
  const [summary, accounts, cards, loans, preference] = await Promise.all([
    api<Summary>("/summary"),
    api<Account[]>("/accounts"),
    api<Card[]>("/cards"),
    api<Loan[]>("/loans"),
    api<DashboardPreference>("/dashboard-preferences"),
  ]);
  const groups = Object.entries(accounts.reduce<Record<string, Account[]>>((result, account) => {
    const label = groupLabel(account, preference.account_grouping);
    (result[label] ??= []).push(account);
    return result;
  }, {})).sort(([a], [b]) => a.localeCompare(b));
  const loanDebt = loans.reduce(
    (sum, loan) => sum + (Number(loan.current_balance) || 0),
    0,
  );
  return <OverviewPrivacy initialHidden={preference.hide_balances}><div className="space-y-8 animate-rise">
      <section className="relative overflow-hidden rounded-2xl border bg-card p-5 shadow-sm sm:p-7">
        <div aria-hidden className="spectrum-edge absolute inset-x-0 top-0 h-1" />
        <div className="flex items-end justify-between gap-8">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Your money, at a glance</p>
            <h1 className="mt-3 break-words font-display text-5xl tracking-[-.055em] sm:text-7xl">
              <PrivateAmount>{money(summary.net_position)}</PrivateAmount>
            </h1>
          </div>
          <div className="flex items-start gap-2 text-right text-sm text-muted-foreground">
            <div className="hidden sm:block">
            <p>Last sync</p>
            <p className="mt-1 text-foreground">
              {summary.last_success_at
                ? shortDate(summary.last_success_at)
                : "Never"}
            </p>
            </div>
            <PrivacyToggle />
          </div>
        </div>
        <div className="mt-7 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border bg-background p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ArrowUpRight className="text-income" /> Cash
            </div>
            <p className="mt-2 text-2xl font-semibold"><PrivateAmount>{money(summary.cash)}</PrivateAmount></p>
          </div>
          <div className="rounded-xl border bg-background p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ArrowDownRight className="text-expense" /> Card debt
            </div>
            <p className="mt-2 text-2xl font-semibold">
              <PrivateAmount>{money(summary.credit_card_debt)}</PrivateAmount>
            </p>
          </div>
          <div className="rounded-xl border bg-background p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Landmark /> Loan debt
            </div>
            <p className="mt-2 text-2xl font-semibold">
              <PrivateAmount>{money(String(loanDebt))}</PrivateAmount>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Across linked loan accounts</p>
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
      <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
        <div className="mb-4 flex items-end justify-between">
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
        {groups.length ? <div className="overflow-hidden rounded-xl border">
          {groups.map(([label, group]) => <details key={label} className="group border-b last:border-b-0">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 outline-none marker:content-none focus-visible:ring-2 focus-visible:ring-ring sm:px-6">
              <div className="min-w-0">
                <p className="truncate font-semibold capitalize">{label}</p>
                <p className="mt-1 text-sm text-muted-foreground">{group.length} {group.length === 1 ? "account" : "accounts"} · Current <PrivateAmount>{total(group, "current_balance")}</PrivateAmount></p>
              </div>
              <div className="hidden text-right sm:block">
                <p className="text-xs text-muted-foreground">Available</p>
                <p className="mt-1 font-mono text-sm font-medium"><PrivateAmount>{total(group, "available_balance")}</PrivateAmount></p>
              </div>
              <ChevronRight className="size-5 shrink-0 text-muted-foreground transition-transform duration-200 ease-out group-open:rotate-90" />
            </summary>
            <div data-slot="disclosure-content">
              <div className="overflow-x-auto border-t">
              <Table>
                <TableHeader><TableRow><TableHead>Account</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Available</TableHead><TableHead className="text-right">Current</TableHead></TableRow></TableHeader>
                <TableBody>{group.map((account) => <TableRow key={account.id} className="group/row">
                  <TableCell><Link href={`/accounts/${account.id}`} className="flex items-center gap-2 rounded-sm font-medium outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"><span>{account.name} {account.mask && <span className="text-muted-foreground">··{account.mask}</span>}</span><ChevronRight className="size-4 text-muted-foreground transition-transform group-hover/row:translate-x-0.5" /></Link>{preference.account_grouping === "account_type" && <p className="text-xs text-muted-foreground">{account.institution_name}</p>}</TableCell>
                  <TableCell><Badge variant="secondary" className="font-normal capitalize">{account.subtype?.replaceAll("_", " ") ?? account.type}</Badge></TableCell>
                  <TableCell className="text-right font-mono"><PrivateAmount>{money(account.available_balance, account.currency)}</PrivateAmount></TableCell>
                  <TableCell className="text-right font-mono font-medium"><PrivateAmount>{money(account.current_balance, account.currency)}</PrivateAmount></TableCell>
                </TableRow>)}</TableBody>
              </Table>
              </div>
            </div>
          </details>)}</div> : <p className="rounded-xl border py-12 text-center text-muted-foreground">Connect your first institution in Settings.</p>}
      </section>
      <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
        <div className="mb-4">
          <p className="font-mono text-xs uppercase tracking-[.18em] text-muted-foreground">
            Obligations
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">
            Upcoming payments
          </h2>
        </div>
        {cards.length || loans.length ? (
          <div className="divide-y border-y">
            {cards.map((card) => (
              <article
                key={card.account_id}
                className="grid gap-4 py-5 md:grid-cols-[1.4fr_repeat(3,1fr)] md:items-center"
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
                    <PrivateAmount>{money(card.current_balance)}</PrivateAmount>
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Minimum due</p>
                  <p className="mt-1 font-mono font-medium">
                    <PrivateAmount>{money(card.minimum_payment)}</PrivateAmount>
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
            {loans.map((loan) => (
              <article
                key={loan.account_id}
                className="grid gap-4 py-5 md:grid-cols-[1.4fr_repeat(3,1fr)] md:items-center"
              >
                <div>
                  <Link
                    href={`/accounts/${loan.account_id}`}
                    className="inline-flex items-center gap-1 rounded-sm font-semibold outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {loan.account_name} {loan.mask && <span className="font-normal text-muted-foreground">··{loan.mask}</span>}
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </Link>
                  <p className="mt-1 text-sm text-muted-foreground">{loan.institution_name} · Loan</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Outstanding balance</p>
                  <p className="mt-1 font-mono font-medium"><PrivateAmount>{money(loan.current_balance)}</PrivateAmount></p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Scheduled payment</p>
                  <p className="mt-1 font-mono font-medium"><PrivateAmount>{money(loan.next_payment_amount)}</PrivateAmount></p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Due date</p>
                  <p className="mt-1 flex items-center gap-2 font-medium"><Clock3 className="size-4 text-muted-foreground" /> {shortDate(loan.next_payment_due_date)}</p>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="border-y py-12 text-center text-muted-foreground">
            No card or loan repayment details are available.
          </p>
        )}
      </section>
    </div></OverviewPrivacy>;
}
