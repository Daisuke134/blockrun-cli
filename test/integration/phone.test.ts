// Run with: npm test (tsx --test --experimental-test-module-mocks)
// PROP-150 (REQ-175–177). Mocks getClient(); asserts every price-table branch and the
// REQ-177 `from` requirement for voice/call.
import { test, mock } from "node:test";
import assert from "node:assert/strict";
import type { BudgetState } from "../../src/types.js";

let lastCall: { endpoint: string; body?: unknown } | undefined;
mock.module("../../src/shell/wallet.js", {
  namedExports: {
    getClient: () => ({
      getWithPaymentRaw: async (endpoint: string) => { lastCall = { endpoint }; return { numbers: [] }; },
      requestWithPaymentRaw: async (endpoint: string, body: unknown) => { lastCall = { endpoint, body }; return { ok: true }; },
    }),
  },
});

const { run } = await import("../../src/commands/phone.js");

function newBudget(): BudgetState {
  return { limit: null, spent: 0, calls: 0, agents: new Map() };
}

test("REQ-176: phone/numbers/list costs $0.001", async () => {
  const budget = newBudget();
  const res = await run({ path: "phone/numbers/list", body: {} }, { json: true }, budget);
  assert.equal(res.exitCode, 0);
  assert.equal(budget.spent, 0.001);
});

test("REQ-177: voice/call without a 'from' field is rejected locally, no network call", async () => {
  const budget = newBudget();
  lastCall = undefined;
  const res = await run({ path: "voice/call", body: { to: "+15551234567", task: "hi" } }, { json: true }, budget);
  assert.notEqual(res.exitCode, 0);
  assert.equal(lastCall, undefined);
  assert.equal(budget.spent, 0);
});

test("REQ-176: voice/call with 'from' costs $0.54", async () => {
  const budget = newBudget();
  const res = await run({ path: "voice/call", body: { to: "+15551234567", from: "+15557654321", task: "hi" } }, { json: true }, budget);
  assert.equal(res.exitCode, 0);
  assert.equal(budget.spent, 0.54);
});
