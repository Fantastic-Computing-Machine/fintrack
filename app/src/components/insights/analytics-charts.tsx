"use client";

import { useMemo, useState } from "react";
import { ListFilter } from "lucide-react";
import { money, shortDate } from "@/lib/api";
import { buildMonthlyRadarData } from "@/lib/monthly-radar";
import type {
  Analytics,
  CashFlowPoint,
  DebtPoint,
  SpendingCategory,
} from "@/lib/types";
import type { ChartConfig } from "@/components/ui/chart";
import { buttonVariants } from "@/components/ui/button";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Area,
  AreaChart,
  CartesianGrid,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  XAxis,
  YAxis,
} from "recharts";

const cashFlowConfig = {
  spending: { label: "Spending", color: "var(--chart-1)" },
  inflows: { label: "Inflows", color: "var(--chart-3)" },
  movements: { label: "Internal movements", color: "var(--chart-5)" },
} satisfies ChartConfig;

const debtTrendConfig = {
  credit_card_debt: { label: "Credit cards", color: "var(--chart-1)" },
  loan_debt: { label: "Loans", color: "var(--chart-3)" },
} satisfies ChartConfig;

const monthlyRadarConfig = {
  spendingIndex: { label: "Monthly spending", color: "var(--chart-1)" },
  debtIndex: { label: "Month-end debt", color: "var(--chart-3)" },
} satisfies ChartConfig;

function monthLabel(month: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short" }).format(
    new Date(`${month}-01T12:00:00Z`),
  );
}

function title(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ");
}
export function CashFlowChart({ points }: { points: CashFlowPoint[] }) {
  return (
    <figure className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
      <figcaption>
        <div>
          <p className="font-mono text-xs uppercase tracking-[.18em] text-muted-foreground">
            Cash flow
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">
            Money in and out
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Hover or focus a day to inspect it. Transfers and debt payments stay
            outside spending.
          </p>
        </div>
      </figcaption>
      {points.length ? (
        <ChartContainer config={cashFlowConfig} className="mt-6 min-h-[280px] w-full">
          <AreaChart accessibilityLayer data={points} margin={{ left: 8, right: 8 }}>
            <defs>
              <linearGradient id="cash-flow-spending" x1="0" x2="0" y1="0" y2="1">
                <stop offset="5%" stopColor="var(--color-spending)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--color-spending)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="cash-flow-inflows" x1="0" x2="0" y1="0" y2="1">
                <stop offset="5%" stopColor="var(--color-inflows)" stopOpacity={0.24} />
                <stop offset="95%" stopColor="var(--color-inflows)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="cash-flow-movements" x1="0" x2="0" y1="0" y2="1">
                <stop offset="5%" stopColor="var(--color-movements)" stopOpacity={0.2} />
                <stop offset="95%" stopColor="var(--color-movements)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="date" tickFormatter={(value) => shortDate(String(value))} tickLine={false} tickMargin={8} axisLine={false} minTickGap={28} />
            <YAxis tickFormatter={(value) => money(String(value))} tickLine={false} tickMargin={8} axisLine={false} width={72} />
            <ChartTooltip content={<ChartTooltipContent labelFormatter={(value) => shortDate(String(value))} />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Area dataKey="spending" type="linear" stroke="var(--color-spending)" fill="url(#cash-flow-spending)" strokeWidth={2} />
            <Area dataKey="inflows" type="linear" stroke="var(--color-inflows)" fill="url(#cash-flow-inflows)" strokeWidth={2} />
            <Area dataKey="movements" type="linear" stroke="var(--color-movements)" fill="url(#cash-flow-movements)" strokeWidth={2} />
          </AreaChart>
        </ChartContainer>
      ) : (
        <p className="mt-8 text-sm text-muted-foreground">
          No posted transaction activity in this period.
        </p>
      )}
    </figure>
  );
}

export function MonthlySpendDebtRadar({
  cashFlow,
  debtHistory,
  endDate,
}: {
  cashFlow: CashFlowPoint[];
  debtHistory: DebtPoint[];
  endDate: string;
}) {
  const data = buildMonthlyRadarData(cashFlow, debtHistory, endDate);
  return (
    <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
      <p className="font-mono text-xs uppercase tracking-[.18em] text-muted-foreground">
        Monthly shape
      </p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight">
        Spending and debt by month
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        The latest twelve calendar months, indexed to each measure&apos;s highest month.
      </p>
      {data.some((point) => point.spending || point.debt) ? (
        <ChartContainer config={monthlyRadarConfig} className="mx-auto mt-5 min-h-[440px] w-full max-w-3xl">
          <RadarChart
            accessibilityLayer
            data={data}
            margin={{ top: 24, right: 36, bottom: 8, left: 36 }}
          >
            <ChartTooltip
              content={
                <ChartTooltipContent labelFormatter={(value) => monthLabel(String(value))} />
              }
            />
            <PolarGrid gridType="polygon" />
            <PolarAngleAxis
              axisLine={false}
              dataKey="month"
              tick={{ fontSize: 11 }}
              tickFormatter={monthLabel}
              tickLine={false}
            />
            <PolarRadiusAxis axisLine={false} domain={[0, 100]} tick={false} />
            <Radar
              dataKey="spendingIndex"
              dot={{ fill: "var(--color-spendingIndex)", r: 3 }}
              fill="var(--color-spendingIndex)"
              fillOpacity={0.14}
              stroke="var(--color-spendingIndex)"
              strokeWidth={2}
            />
            <Radar
              dataKey="debtIndex"
              dot={{ fill: "var(--color-debtIndex)", r: 3 }}
              fill="var(--color-debtIndex)"
              fillOpacity={0.04}
              stroke="var(--color-debtIndex)"
              strokeDasharray="5 4"
              strokeWidth={2}
            />
            <ChartLegend content={<ChartLegendContent />} />
          </RadarChart>
        </ChartContainer>
      ) : (
        <p className="mt-8 border border-dashed py-10 text-center text-sm text-muted-foreground">
          Monthly spending and debt will appear after your first successful sync.
        </p>
      )}
    </section>
  );
}

export function SpendingBreakdown({
  categories,
}: {
  categories: SpendingCategory[];
}) {
  const [selected, setSelected] = useState(
    () => new Set(categories.map((category) => category.category)),
  );
  const visible = useMemo(
    () => categories.filter((category) => selected.has(category.category)),
    [categories, selected],
  );
  const total = visible.reduce(
    (sum, category) => sum + Number(category.amount),
    0,
  );
  const toggle = (category: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  return (
    <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[.18em] text-muted-foreground">
            Diversification
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">
            Spending by category
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose the categories that make up this distribution.
          </p>
        </div>
        {categories.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <ListFilter className="size-3.5" />
              Categories
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuGroup>
                <DropdownMenuLabel>
                  {selected.size} of {categories.length} selected
                </DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                {categories.map((category) => (
                  <DropdownMenuCheckboxItem
                    key={category.category}
                    checked={selected.has(category.category)}
                    onCheckedChange={() => toggle(category.category)}
                  >
                    {title(category.category)}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      {visible.length ? (
        <div className="mt-6 space-y-4">
          {visible.map((category) => {
            const share = total ? Number(category.amount) / total : 0;
            return (
              <div key={category.category}>
                <div className="flex items-baseline justify-between gap-4">
                  <p className="text-sm font-medium">
                    {title(category.category)}
                  </p>
                  <p className="shrink-0 font-mono text-sm">
                    {money(category.amount)}{" "}
                    <span className="text-xs text-muted-foreground">
                      {(share * 100).toFixed(1)}%
                    </span>
                  </p>
                </div>
                <div
                  className="mt-2 h-2 overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                  aria-label={`${title(category.category)} ${money(category.amount)}`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(share * 100)}
                >
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-300"
                    style={{ width: `${share * 100}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="mt-8 border border-dashed py-10 text-center text-sm text-muted-foreground">
          Choose at least one category to see its distribution.
        </p>
      )}
    </section>
  );
}

export function DebtTrend({ analytics }: { analytics: Analytics }) {
  const points = analytics.debt_history;
  return (
    <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
      <p className="font-mono text-xs uppercase tracking-[.18em] text-muted-foreground">
        Debt trend
      </p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight">
        Credit and loan balances
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Daily observations; hover or focus a point for the recorded balance.
      </p>
      {analytics.debt_history_available ? (
        <ChartContainer config={debtTrendConfig} className="mt-6 min-h-[280px] w-full">
          <AreaChart accessibilityLayer data={points} margin={{ left: 8, right: 8 }}>
            <defs>
              <linearGradient id="debt-cards" x1="0" x2="0" y1="0" y2="1">
                <stop offset="5%" stopColor="var(--color-credit_card_debt)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--color-credit_card_debt)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="debt-loans" x1="0" x2="0" y1="0" y2="1">
                <stop offset="5%" stopColor="var(--color-loan_debt)" stopOpacity={0.24} />
                <stop offset="95%" stopColor="var(--color-loan_debt)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="date" tickFormatter={(value) => shortDate(String(value))} tickLine={false} tickMargin={8} axisLine={false} minTickGap={28} />
            <YAxis tickFormatter={(value) => money(String(value))} tickLine={false} tickMargin={8} axisLine={false} width={72} />
            <ChartTooltip content={<ChartTooltipContent labelFormatter={(value) => shortDate(String(value))} />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Area dataKey="credit_card_debt" type="linear" stroke="var(--color-credit_card_debt)" fill="url(#debt-cards)" strokeWidth={2} />
            <Area dataKey="loan_debt" type="linear" stroke="var(--color-loan_debt)" fill="url(#debt-loans)" strokeWidth={2} />
          </AreaChart>
        </ChartContainer>
      ) : (
        <p className="mt-8 border border-dashed py-10 text-center text-sm text-muted-foreground">
          Debt history starts with the next successful sync.
        </p>
      )}
    </section>
  );
}
