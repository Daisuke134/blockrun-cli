// Run with: npm test (tsx --test --experimental-test-module-mocks)
// PROP-141 (REQ-166–169). Mocks getClient()'s requestWithPaymentRaw.
import { test, mock } from "node:test";
import assert from "node:assert/strict";
import type { BudgetState } from "../../src/types.js";

let lastCall: { endpoint: string; body: unknown } | undefined;
mock.module("../../src/shell/wallet.js", {
  namedExports: {
    getClient: () => ({
      requestWithPaymentRaw: async (endpoint: string, body: unknown) => {
        lastCall = { endpoint, body };
        return { jsonrpc: "2.0", id: 1, result: "0x123" };
      },
    }),
  },
});

const { run } = await import("../../src/commands/rpc.js");

function newBudget(): BudgetState {
  return { limit: null, spent: 0, calls: 0, agents: new Map() };
}

test("REQ-169: a single call costs $0.002 and dispatches to /v1/rpc/{network}", async () => {
  const budget = newBudget();
  const res = await run({ network: "base", method: "eth_blockNumber" }, { json: true }, budget);
  assert.equal(res.exitCode, 0);
  assert.equal(budget.spent, 0.002);
  assert.match(lastCall!.endpoint, /\/v1\/rpc\/base$/);
  assert.equal((lastCall!.body as any).method, "eth_blockNumber");
});

test("REQ-169: a 2-element batch body costs $0.004", async () => {
  const budget = newBudget();
  const res = await run({ network: "base", body: [{ jsonrpc: "2.0", id: 1, method: "a" }, { jsonrpc: "2.0", id: 2, method: "b" }] }, { json: true }, budget);
  assert.equal(res.exitCode, 0);
  assert.equal(budget.spent, 0.004);
});
