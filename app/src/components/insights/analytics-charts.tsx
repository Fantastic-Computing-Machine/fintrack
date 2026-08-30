"use client";

import { useMemo, useState } from "react";
import { ListFilter } from "lucide-react";
import { money, shortDate } from "@/lib/api";
import type {
  Analytics,
  CashFlowPoint,
  DebtPoint,
  SpendingCategory,
} from "@/lib/types";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function title(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ");
}
function maxFlow(points: CashFlowPoint[]) {
  return Math.max(
    1,
    ...points.flatMap((point) => [
      Number(point.spending),
      Number(point.inflows),
      Number(point.movements),
    ]),
  );
}

export function CashFlowChart({ points }: { points: CashFlowPoint[] }) {
  const [activeDate, setActiveDate] = useState(points.at(-1)?.date ?? "");
  const active =
    points.find((point) => point.date === activeDate) ?? points.at(-1);
  const maximum = maxFlow(points);
  const middle = points[Math.floor(points.length / 2)];
  return (
    <figure className="border-y py-7">
      <figcaption className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
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
        {active && (
          <div
            aria-live="polite"
            className="grid grid-cols-3 gap-2 border-t pt-3 text-right text-[11px] sm:gap-x-5 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0 sm:text-xs"
          >
            <Value
              label={shortDate(active.date)}
              value={money(active.spending)}
              hint="spending"
            />
            <Value
              label="Inflows"
              value={money(active.inflows)}
              hint="received"
              accent
            />
            <Value
              label="Movements"
              value={money(active.movements)}
              hint="internal"
            />
          </div>
        )}
      </figcaption>
      {points.length ? (
        <>
          <div className="mt-7 grid grid-cols-[3.5rem_1fr] gap-3">
            <div
              aria-hidden
              className="flex h-60 flex-col justify-between py-1 text-right font-mono text-[10px] text-muted-foreground"
            >
              <span>{money(String(maximum))}</span>
              <span>{money(String(maximum / 2))}</span>
              <span>$0</span>
            </div>
            <div>
              <div className="relative h-60 border-b">
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 flex flex-col justify-between"
                >
                  <i className="border-t border-dashed border-border" />
                  <i className="border-t border-dashed border-border" />
                  <i className="border-t border-dashed border-border" />
                </div>
                <div
                  className="relative grid h-full items-end gap-1 px-1"
                  style={{
                    gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))`,
                  }}
                >
                  {points.map((point) => (
                    <button
                      key={point.date}
                      type="button"
                      onMouseEnter={() => setActiveDate(point.date)}
                      onFocus={() => setActiveDate(point.date)}
                      className="group flex h-full min-w-0 items-end justify-center gap-px rounded-t-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={`${shortDate(point.date)}: ${money(point.spending)} spending, ${money(point.inflows)} inflows, ${money(point.movements)} internal movements`}
                    >
                      <span
                        className="w-full max-w-3 rounded-t bg-foreground/75 transition-colors group-hover:bg-foreground group-focus:bg-foreground"
                        style={{
                          height: `${(Number(point.spending) / maximum) * 100}%`,
                        }}
                      />
                      <span
                        className="w-full max-w-3 rounded-t bg-primary/80 transition-colors group-hover:bg-primary group-focus:bg-primary"
                        style={{
                          height: `${(Number(point.inflows) / maximum) * 100}%`,
                        }}
                      />
                      <span
                        className="w-full max-w-3 rounded-t bg-muted-foreground/40 transition-colors group-hover:bg-muted-foreground/70 group-focus:bg-muted-foreground/70"
                        style={{
                          height: `${(Number(point.movements) / maximum) * 100}%`,
                        }}
                      />
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-3 flex justify-between text-xs text-muted-foreground">
                <span>{shortDate(points[0].date)}</span>
                <span>{middle && shortDate(middle.date)}</span>
                <span>{shortDate(points.at(-1)?.date ?? "")}</span>
              </div>
            </div>
          </div>
          <div className="mt-2 grid grid-cols-[3.5rem_1fr] gap-3">
            <span className="text-right text-[10px] uppercase tracking-widest text-muted-foreground">
              USD
            </span>
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Date
            </span>
          </div>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
            <span>
              <i className="mr-1 inline-block size-2 rounded-sm bg-foreground" />
              Spending
            </span>
            <span>
              <i className="mr-1 inline-block size-2 rounded-sm bg-primary" />
              Inflows
            </span>
            <span>
              <i className="mr-1 inline-block size-2 rounded-sm bg-muted-foreground/50" />
              Internal movements
            </span>
          </div>
        </>
      ) : (
        <p className="mt-8 text-sm text-muted-foreground">
          No posted transaction activity in this period.
        </p>
      )}
    </figure>
  );
}

function Value({
  label,
  value,
  hint,
  accent = false,
}: {
  label: string;
  value: string;
  hint: string;
  accent?: boolean;
}) {
  return (
    <p>
      <span className="block text-muted-foreground">{label}</span>
      <span
        className={`font-mono text-sm font-semibold ${accent ? "text-primary" : ""}`}
      >
        {value}
      </span>
      <span className="block text-muted-foreground">{hint}</span>
    </p>
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
    <section>
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
              <DropdownMenuLabel>
                {selected.size} of {categories.length} selected
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {categories.map((category) => (
                <DropdownMenuCheckboxItem
                  key={category.category}
                  checked={selected.has(category.category)}
                  onCheckedChange={() => toggle(category.category)}
                >
                  {title(category.category)}
                </DropdownMenuCheckboxItem>
              ))}
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
                      {(share * 100).toFixed(0)}%
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

function linePoints(
  points: DebtPoint[],
  key: "credit_card_debt" | "loan_debt",
  maximum: number,
) {
  return points.map((point, index) => ({
    x: points.length === 1 ? 200 : (index / (points.length - 1)) * 340 + 40,
    y: 160 - (Number(point[key]) / maximum) * 130,
  }));
}

export function DebtTrend({ analytics }: { analytics: Analytics }) {
  const points = analytics.debt_history;
  const [activeIndex, setActiveIndex] = useState(
    Math.max(0, points.length - 1),
  );
  const active = points[activeIndex];
  const maximum = Math.max(
    1,
    ...points.flatMap((point) => [
      Number(point.credit_card_debt),
      Number(point.loan_debt),
    ]),
  );
  const cards = linePoints(points, "credit_card_debt", maximum);
  const loans = linePoints(points, "loan_debt", maximum);
  return (
    <section className="border-y py-7">
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
        <>
          <div
            aria-live="polite"
            className="mt-5 flex items-end justify-between border-b pb-3"
          >
            <p className="text-sm text-muted-foreground">
              {active && shortDate(active.date)}
            </p>
            {active && (
              <p className="font-mono text-sm">
                <span className="text-primary">
                  {money(active.credit_card_debt)}
                </span>{" "}
                cards{" "}
                <span className="ml-3">{money(active.loan_debt)} loans</span>
              </p>
            )}
          </div>
          <div className="mt-4 grid grid-cols-[3.5rem_1fr] gap-2">
            <div className="flex h-56 flex-col justify-between py-4 text-right font-mono text-[10px] text-muted-foreground">
              <span>{money(String(maximum))}</span>
              <span>{money(String(maximum / 2))}</span>
              <span>$0</span>
            </div>
            <svg
              className="h-56 w-full overflow-visible"
              viewBox="0 0 400 190"
              role="img"
              aria-label="Debt trend chart, with separate credit-card and loan balance lines"
            >
              <line
                x1="40"
                x2="380"
                y1="160"
                y2="160"
                stroke="currentColor"
                className="text-border"
              />
              <line
                x1="40"
                x2="380"
                y1="95"
                y2="95"
                stroke="currentColor"
                strokeDasharray="3 4"
                className="text-border"
              />
              <polyline
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                points={cards.map((point) => `${point.x},${point.y}`).join(" ")}
                className="text-primary"
              />
              <polyline
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeDasharray="6 5"
                points={loans.map((point) => `${point.x},${point.y}`).join(" ")}
                className="text-foreground/60"
              />
              {points.map((point, index) => (
                <g key={point.date}>
                  <circle
                    cx={cards[index].x}
                    cy={cards[index].y}
                    r="5"
                    tabIndex={0}
                    role="button"
                    onMouseEnter={() => setActiveIndex(index)}
                    onFocus={() => setActiveIndex(index)}
                    aria-label={`${shortDate(point.date)}: credit cards ${money(point.credit_card_debt)}, loans ${money(point.loan_debt)}`}
                    className="fill-primary stroke-background stroke-2"
                  />
                  <circle
                    cx={loans[index].x}
                    cy={loans[index].y}
                    r="5"
                    tabIndex={0}
                    role="button"
                    onMouseEnter={() => setActiveIndex(index)}
                    onFocus={() => setActiveIndex(index)}
                    aria-label={`${shortDate(point.date)}: credit cards ${money(point.credit_card_debt)}, loans ${money(point.loan_debt)}`}
                    className="fill-foreground/70 stroke-background stroke-2"
                  />
                </g>
              ))}
            </svg>
          </div>
          <div className="ml-14 mt-1 flex justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
            <span>Date · {shortDate(points[0].date)}</span>
            <span>{shortDate(points.at(-1)?.date ?? "")}</span>
          </div>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
            <span>
              <i className="mr-1 inline-block size-2 rounded-sm bg-primary" />
              Credit cards
            </span>
            <span>
              <i className="mr-1 inline-block size-2 rounded-sm bg-foreground/60" />
              Loans
            </span>
          </div>
        </>
      ) : (
        <p className="mt-8 border border-dashed py-10 text-center text-sm text-muted-foreground">
          Debt history starts with the next successful sync.
        </p>
      )}
    </section>
  );
}
