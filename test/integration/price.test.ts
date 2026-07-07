// Run with: npm test (tsx --test --experimental-test-module-mocks)
// PROP-135 (REQ-159–162). Mocks getPriceClient(paid) so free-vs-paid client selection
// is directly assertable.
import { test, mock } from "node:test";
import assert from "node:assert/strict";
import type { BudgetState } from "../../src/types.js";

let lastPaidFlag: boolean | undefined;
mock.module("../../src/shell/wallet.js", {
  namedExports: {
    getChain: () => "base",
    getPriceClient: (paid: boolean) => {
      lastPaidFlag = paid;
      return {
        price: async () => ({ price: 65000 }),
        history: async () => ({ bars: [] }),
        listSymbols: async () => ({ symbols: ["BTC-USD"] }),
      };
    },
  },
});

const { run } = await import("../../src/commands/price.js");

function newBudget(): BudgetState {
  return { limit: null, spent: 0, calls: 0, agents: new Map() };
}

test("REQ-161: crypto price is free (paid=false) and never touches the budget ledger", async () => {
  const budget = newBudget();
  const res = await run({ action: "price", category: "crypto", symbol: "BTC-USD" }, { json: true }, budget);
  assert.equal(res.exitCode, 0);
  assert.equal(lastPaidFlag, false);
  assert.equal(budget.spent, 0);
});

test("REQ-161: stocks price is paid (paid=true) and costs $0.001", async () => {
  const budget = newBudget();
  const res = await run({ action: "price", category: "stocks", symbol: "AAPL", market: "us" }, { json: true }, budget);
  assert.equal(res.exitCode, 0);
  assert.equal(lastPaidFlag, true);
  assert.equal(budget.spent, 0.001);
});
