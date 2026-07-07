// Run with: npm test (tsx --test --experimental-test-module-mocks)
// PROP-153 (REQ-178–181). Mocks getClient(); asserts GET/POST dispatch by body
// presence and the tiered cost.
import { test, mock } from "node:test";
import assert from "node:assert/strict";
import type { BudgetState } from "../../src/types.js";

let lastGet: { endpoint: string; params?: unknown } | undefined;
let lastPost: { endpoint: string; body: unknown } | undefined;
mock.module("../../src/shell/wallet.js", {
  namedExports: {
    getClient: () => ({
      getWithPaymentRaw: async (endpoint: string, params?: unknown) => { lastGet = { endpoint, params }; return { price: 65000 }; },
      requestWithPaymentRaw: async (endpoint: string, body: unknown) => { lastPost = { endpoint, body }; return { rows: [] }; },
    }),
  },
});

const { run } = await import("../../src/commands/surf.js");

function newBudget(): BudgetState {
  return { limit: null, spent: 0, calls: 0, agents: new Map() };
}

test("REQ-181: no body -> GET, Tier 1 default cost $0.001", async () => {
  const budget = newBudget();
  const res = await run({ path: "market/price", params: { symbol: "BTC" } }, { json: true }, budget);
  assert.equal(res.exitCode, 0);
  assert.equal(budget.spent, 0.001);
  assert.equal((lastGet!.params as any).symbol, "BTC");
});

test("REQ-181/REQ-179: a body -> POST, Tier 3 cost $0.02 for onchain/sql", async () => {
  const budget = newBudget();
  const res = await run({ path: "onchain/sql", body: { sql: "SELECT 1" } }, { json: true }, budget);
  assert.equal(res.exitCode, 0);
  assert.equal(budget.spent, 0.02);
  assert.match(lastPost!.endpoint, /\/v1\/surf\/onchain\/sql$/);
});
