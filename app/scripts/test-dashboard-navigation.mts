import assert from "node:assert/strict";
import test from "node:test";
import {
  dashboardNavigation,
  isDashboardPath,
} from "../src/lib/dashboard-navigation.mjs";

test("marks detail routes as belonging to their primary dashboard section", () => {
  assert.equal(isDashboardPath("/transactions", "/transactions"), true);
  assert.equal(isDashboardPath("/accounts/42", "/"), true);
  assert.equal(isDashboardPath("/accounts/42", "/transactions"), false);
});

test("keeps the route map to the four approved destinations", () => {
  assert.deepEqual(
    dashboardNavigation.map(({ href }) => href),
    ["/", "/transactions", "/insights", "/settings"],
  );
});
