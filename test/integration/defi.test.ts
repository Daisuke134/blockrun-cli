// Run with: npm test (tsx --test --experimental-test-module-mocks)
// PROP-144 (REQ-170–171). Mocks getClient()'s getWithPaymentRaw.
import { test, mock } from "node:test";
import assert from "node:assert/strict";
import type { BudgetState } from "../../src/types.js";

let lastEndpoint: string | undefined;
mock.module("../../src/shell/wallet.js", {
  namedExports: {
    getClient: () => ({
      getWithPaymentRaw: async (endpoint: string) => {
        lastEndpoint = endpoint;
        return { coingecko: { bitcoin: { usd: 65000 } } };
      },
    }),
  },
});

const { run } = await import("../../src/commands/defi.js");

function newBudget(): BudgetState {
  return { limit: null, spent: 0, calls: 0, agents: new Map() };
}

test("REQ-171: prices/* costs $0.001 and hits /v1/defillama/prices/...", async () => {
  const budget = newBudget();
  const res = await run({ path: "prices/coingecko:bitcoin" }, { json: true }, budget);
  assert.equal(res.exitCode, 0);
  assert.equal(budget.spent, 0.001);
  assert.match(lastEndpoint!, /\/v1\/defillama\/prices\/coingecko:bitcoin$/);
});

test("REQ-171: chains costs $0.005", async () => {
  const budget = newBudget();
  const res = await run({ path: "chains" }, { json: true }, budget);
  assert.equal(res.exitCode, 0);
  assert.equal(budget.spent, 0.005);
});
