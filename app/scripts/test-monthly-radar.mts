import assert from "node:assert/strict";
import test from "node:test";

let buildMonthlyRadarData: typeof import("../src/lib/monthly-radar.ts").buildMonthlyRadarData | undefined;
try {
  ({ buildMonthlyRadarData } = await import("../src/lib/monthly-radar.ts"));
} catch {}

test("always returns twelve calendar months and carries debt forward", () => {
  assert.equal(typeof buildMonthlyRadarData, "function");
  assert.deepEqual(
    buildMonthlyRadarData!(
      [
        { date: "2026-01-03", spending: "10" },
        { date: "2026-01-31", spending: "15" },
        { date: "2026-02-04", spending: "20" },
        { date: "2026-03-06", spending: "30" },
      ],
      [
        { date: "2026-01-10", credit_card_debt: "100", loan_debt: "0" },
        { date: "2026-02-02", credit_card_debt: "80", loan_debt: "0" },
        { date: "2026-02-24", credit_card_debt: "75", loan_debt: "0" },
      ],
      "2026-12-31",
    ),
    [
      { month: "2026-01", spending: 25, debt: 100, spendingIndex: 83, debtIndex: 100 },
      { month: "2026-02", spending: 20, debt: 75, spendingIndex: 67, debtIndex: 75 },
      { month: "2026-03", spending: 30, debt: 75, spendingIndex: 100, debtIndex: 75 },
      { month: "2026-04", spending: 0, debt: 75, spendingIndex: 0, debtIndex: 75 },
      { month: "2026-05", spending: 0, debt: 75, spendingIndex: 0, debtIndex: 75 },
      { month: "2026-06", spending: 0, debt: 75, spendingIndex: 0, debtIndex: 75 },
      { month: "2026-07", spending: 0, debt: 75, spendingIndex: 0, debtIndex: 75 },
      { month: "2026-08", spending: 0, debt: 75, spendingIndex: 0, debtIndex: 75 },
      { month: "2026-09", spending: 0, debt: 75, spendingIndex: 0, debtIndex: 75 },
      { month: "2026-10", spending: 0, debt: 75, spendingIndex: 0, debtIndex: 75 },
      { month: "2026-11", spending: 0, debt: 75, spendingIndex: 0, debtIndex: 75 },
      { month: "2026-12", spending: 0, debt: 75, spendingIndex: 0, debtIndex: 75 },
    ],
  );
});
