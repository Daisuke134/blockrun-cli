// Run with: npm test (tsx --test --experimental-test-module-mocks)
// PROP-147 (REQ-172–174). Mocks buildClientWithTimeout() to assert the dispatch shape
// AND that the client is built with a timeout that covers the requested exec duration.
import { test, mock } from "node:test";
import assert from "node:assert/strict";
import type { BudgetState } from "../../src/types.js";

let lastTimeoutMs: number | undefined;
let lastCall: { endpoint: string; body: unknown } | undefined;
mock.module("../../src/shell/wallet.js", {
  namedExports: {
    buildClientWithTimeout: (ms: number) => {
      lastTimeoutMs = ms;
      return {
        requestWithPaymentRaw: async (endpoint: string, body: unknown) => {
          lastCall = { endpoint, body };
          return { sandbox_id: "sb_fake" };
        },
      };
    },
  },
});

const { run } = await import("../../src/commands/modal.js");

function newBudget(): BudgetState {
  return { limit: null, spent: 0, calls: 0, agents: new Map() };
}

test("REQ-173/REQ-174: sandbox/create costs $0.01 and sizes the timeout to cover the requested duration", async () => {
  const budget = newBudget();
  const res = await run({ path: "sandbox/create", body: { timeout: 600 } }, { json: true }, budget);
  assert.equal(res.exitCode, 0);
  assert.equal(budget.spent, 0.01);
  assert.equal(lastTimeoutMs, 600 * 1000 + 15_000);
  assert.match(lastCall!.endpoint, /\/v1\/modal\/sandbox\/create$/);
});

test("REQ-173: sandbox/status costs $0.001", async () => {
  const budget = newBudget();
  const res = await run({ path: "sandbox/status", body: { sandbox_id: "sb_fake" } }, { json: true }, budget);
  assert.equal(res.exitCode, 0);
  assert.equal(budget.spent, 0.001);
});
