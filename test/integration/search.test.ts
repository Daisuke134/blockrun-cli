// Run with: npm test (tsx --test --experimental-test-module-mocks)
// PROP-126 (REQ-152–153). Mocks getClient()'s requestWithPaymentRaw.
import { test, mock } from "node:test";
import assert from "node:assert/strict";
import type { BudgetState } from "../../src/types.js";

let lastCall: { endpoint: string; body: unknown } | undefined;
mock.module("../../src/shell/wallet.js", {
  namedExports: {
    getClient: () => ({
      requestWithPaymentRaw: async (endpoint: string, body: unknown) => {
        lastCall = { endpoint, body };
        return { results: [{ title: "fake" }] };
      },
    }),
  },
});

const { run } = await import("../../src/commands/search.js");

function newBudget(): BudgetState {
  return { limit: null, spent: 0, calls: 0, agents: new Map() };
}

test("REQ-153: --max-results 1 charges $0.025 and forwards the mapped body", async () => {
  const budget = newBudget();
  const res = await run({ query: "test", maxResults: 1 }, { json: true }, budget);
  assert.equal(res.exitCode, 0);
  assert.equal(budget.spent, 0.025);
  assert.equal((lastCall!.body as any).query, "test");
  assert.equal((lastCall!.body as any).max_results, 1);
});
