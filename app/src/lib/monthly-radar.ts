import type { CashFlowPoint, DebtPoint } from "@/lib/types";

export type MonthlyRadarPoint = {
  month: string;
  spending: number;
  debt: number;
  spendingIndex: number;
  debtIndex: number;
};

export function buildMonthlyRadarData(
  cashFlow: Pick<CashFlowPoint, "date" | "spending">[],
  debtHistory: Pick<DebtPoint, "date" | "credit_card_debt" | "loan_debt">[],
  endDate: string,
): MonthlyRadarPoint[] {
  const months = new Map<string, { spending: number; debt?: number; debtDate?: string }>();
  const month = (date: string) => date.slice(0, 7);

  for (const point of cashFlow) {
    const key = month(point.date);
    const value = months.get(key) ?? { spending: 0 };
    value.spending += Number(point.spending) || 0;
    months.set(key, value);
  }
  for (const point of debtHistory) {
    const key = month(point.date);
    const value = months.get(key) ?? { spending: 0 };
    if (!value.debtDate || point.date >= value.debtDate) {
      value.debt = (Number(point.credit_card_debt) || 0) + (Number(point.loan_debt) || 0);
      value.debtDate = point.date;
    }
    months.set(key, value);
  }

  const end = new Date(`${month(endDate)}-01T12:00:00Z`);
  const calendarMonths = Array.from({ length: 12 }, (_, index) => {
    const value = new Date(end);
    value.setUTCMonth(value.getUTCMonth() - 11 + index);
    return value.toISOString().slice(0, 7);
  });
  let latestDebt = 0;
  const values = calendarMonths.map((month) => {
    const value = months.get(month);
    latestDebt = value?.debt ?? latestDebt;
    return { month, spending: value?.spending ?? 0, debt: latestDebt };
  });
  const maxSpending = Math.max(1, ...values.map((value) => value.spending));
  const maxDebt = Math.max(1, ...values.map((value) => value.debt));

  return values.map((value) => ({
    ...value,
    spendingIndex: Math.round((value.spending / maxSpending) * 100),
    debtIndex: Math.round((value.debt / maxDebt) * 100),
  }));
}
