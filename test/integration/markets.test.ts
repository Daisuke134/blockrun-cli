// Run with: npm test (tsx --test --experimental-test-module-mocks)
// PROP-132 (REQ-156–158). GET without body dispatches llm.pm(); POST with body
// dispatches llm.pmQuery().
import { test, mock } from "node:test";
import assert from "node:assert/strict";
import type { BudgetState } from "../../src/types.js";

let pmCalled: unknown[] | undefined;
let pmQueryCalled: unknown[] | undefined;
mock.module("../../src/shell/wallet.js", {
  namedExports: {
    getClient: () => ({
      pm: async (...args: unknown[]) => { pmCalled = args; return { events: [] }; },
      pmQuery: async (...args: unknown[]) => { pmQueryCalled = args; return { ok: true }; },
    }),
  },
});

const { run } = await import("../../src/commands/markets.js");

function newBudget(): BudgetState {
  return { limit: null, spent: 0, calls: 0, agents: new Map() };
}

test("REQ-158: a GET call (no body) dispatches pm(path, params) and costs $0.001", async () => {
  const budget = newBudget();
  const res = await run({ path: "polymarket/events" }, { json: true }, budget);
  assert.equal(res.exitCode, 0);
  assert.equal(pmCalled?.[0], "polymarket/events");
  assert.equal(budget.spent, 0.001);
});

test("REQ-158: a body-bearing call dispatches pmQuery(path, body) and costs $0.005", async () => {
  const budget = newBudget();
  const res = await run({ path: "polymarket/wallet/identities", body: { addresses: [] } }, { json: true }, budget);
  assert.equal(res.exitCode, 0);
  assert.equal(pmQueryCalled?.[0], "polymarket/wallet/identities");
  assert.equal(budget.spent, 0.005);
});
