import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowDownRight, ArrowRightLeft, ArrowUpRight } from "lucide-react";
import {
  CashFlowChart,
  DebtTrend,
  SpendingBreakdown,
} from "@/components/insights/analytics-charts";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import type { Analytics, AnalyticsRange } from "@/lib/types";

export const dynamic = "force-dynamic";

const ranges: Array<[AnalyticsRange, string]> = [
  ["1w", "1W"],
  ["1m", "1M"],
  ["3m", "3M"],
  ["6m", "6M"],
  ["1y", "1Y"],
  ["all", "All"],
];

export default async function Insights({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; start?: string; end?: string }>;
}) {
  const params = await searchParams;
  const validDate = (value?: string) =>
    Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
  const custom = validDate(params.start) && validDate(params.end);
  const selected = custom
    ? "custom"
    : ranges.some(([value]) => value === params.range)
      ? (params.range as AnalyticsRange)
      : "1m";
  const analytics = await api<Analytics>(
    `/analytics?${custom ? `start=${params.start}&end=${params.end}` : `range=${selected}`}`,
  );
  const activeDays = analytics.cash_flow.filter(
    (point) =>
      Number(point.spending) ||
      Number(point.inflows) ||
      Number(point.movements),
  ).length;
  const largest = analytics.spending_categories[0];

  return (
    <div className="space-y-8 animate-rise">
      <section className="relative overflow-hidden rounded-2xl border bg-card p-5 shadow-sm sm:p-7">
        <div aria-hidden className="spectrum-edge absolute inset-x-0 top-0 h-1" />
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <p className="font-mono text-xs uppercase tracking-[.18em] text-muted-foreground">
              Insights
            </p>
          <h1 className="mt-2 font-display text-4xl tracking-[-.045em] sm:text-5xl">
              Money movement
            </h1>
            <p className="mt-2 text-muted-foreground">
              Posted activity from {shortDate(analytics.from_date)} to{" "}
              {shortDate(analytics.to_date)}.
            </p>
          </div>
          <nav
            aria-label="Insight period"
            className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1"
          >
            {ranges.map(([value, label]) => (
              <Link
                key={value}
                href={`/insights?range=${value}`}
                aria-current={value === selected ? "page" : undefined}
                className={buttonVariants({
                  variant: value === selected ? "secondary" : "ghost",
                  size: "sm",
                })}
              >
                {label}
              </Link>
            ))}
            <DropdownMenu>
              <DropdownMenuTrigger
                className={buttonVariants({
                  variant: selected === "custom" ? "secondary" : "ghost",
                  size: "sm",
                })}
              >
                Custom
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72 p-3">
                <form action="/insights" className="grid gap-3">
                  <div>
                    <Label htmlFor="start">From</Label>
                    <Input
                      id="start"
                      name="start"
                      type="date"
                      defaultValue={custom ? params.start : ""}
                      className="mt-2 w-full"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="end">To</Label>
                    <Input
                      id="end"
                      name="end"
                      type="date"
                      defaultValue={custom ? params.end : ""}
                      className="mt-2 w-full"
                      required
                    />
                  </div>
                  <Button type="submit" size="sm" className="w-full">
                    Apply range
                  </Button>
                </form>
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>
        </div>
        <div className="mt-7 grid gap-3 sm:grid-cols-3">
          <Metric
            icon={<ArrowDownRight className="size-4" />}
            label="Spending"
            value={money(analytics.spending_total)}
          />
          <Metric
            icon={<ArrowUpRight className="size-4 text-primary" />}
            label="Inflows"
            value={money(analytics.inflows_total)}
          />
          <Metric
            icon={<ArrowRightLeft className="size-4" />}
            label="Internal movements"
            value={money(analytics.movements_total)}
          />
        </div>
        <div className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
          <p className="rounded-xl border bg-background p-4">
            <span className="block text-muted-foreground">Net cash flow</span>
            <span className="font-mono font-semibold">
              {money(
                String(
                  Number(analytics.inflows_total) -
                    Number(analytics.spending_total),
                ),
              )}
            </span>
          </p>
          <p className="rounded-xl border bg-background p-4">
            <span className="block text-muted-foreground">Active days</span>
            <span className="font-mono font-semibold">
              {activeDays} of {analytics.cash_flow.length}
            </span>
          </p>
          <p className="rounded-xl border bg-background p-4">
            <span className="block text-muted-foreground">
              Largest category
            </span>
            <span className="font-medium">
              {largest
                ? `${largest.category.replaceAll("_", " ")} · ${money(largest.amount)}`
                : "Unavailable"}
            </span>
          </p>
        </div>
      </section>

      <CashFlowChart points={analytics.cash_flow} />
      <div className="grid gap-5 lg:grid-cols-2">
        <SpendingBreakdown categories={analytics.spending_categories} />
        <DebtTrend analytics={analytics} />
      </div>

      <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
        <div className="mb-5 flex items-end justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[.18em] text-muted-foreground">
              Current debt
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              Account balances
            </h2>
          </div>
          <p className="text-right text-sm text-muted-foreground">
            {money(analytics.credit_card_debt)} cards
            <br />
            {money(analytics.loan_debt)} loans
          </p>
        </div>
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Current balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {analytics.debt_accounts.length ? (
                analytics.debt_accounts.map((account) => (
                  <TableRow key={account.account_id}>
                    <TableCell>
                      <Link
                        href={`/accounts/${account.account_id}`}
                        className="rounded-sm font-medium outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {account.account_name}
                        <p className="text-xs font-normal text-muted-foreground">
                          {account.institution_name}
                        </p>
                      </Link>
                    </TableCell>
                    <TableCell className="capitalize">
                      {account.account_type === "credit"
                        ? "Credit card"
                        : "Loan"}
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium">
                      {money(account.current_balance)}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="h-28 text-center text-muted-foreground"
                  >
                    No active credit or loan balances are available.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border bg-background p-4">
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}
