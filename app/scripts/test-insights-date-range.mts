import assert from "node:assert/strict";
import test from "node:test";

let isValidCustomInsightsRange:
  | typeof import("../src/lib/insights-date-range.ts").isValidCustomInsightsRange
  | undefined;
try {
  ({ isValidCustomInsightsRange } = await import(
    "../src/lib/insights-date-range.ts"
  ));
} catch {}

test("rejects invalid and future custom Insights date ranges before requesting analytics", () => {
  assert.equal(typeof isValidCustomInsightsRange, "function");
  assert.equal(isValidCustomInsightsRange!("2026-07-30", "2026-08-31", "2026-08-31"), true);
  assert.equal(isValidCustomInsightsRange!("2026-07-30", "2026-09-05", "2026-08-31"), false);
  assert.equal(isValidCustomInsightsRange!("2026-08-31", "2026-07-30", "2026-08-31"), false);
  assert.equal(isValidCustomInsightsRange!("2026-8-1", "2026-08-31", "2026-08-31"), false);
});
