// Run with: npm test (tsx --test --experimental-test-module-mocks)
// PROP-011a (REQ-019c, REQ-020). A paid command's settlement path, given a FIXTURE
// persisted ledger (mocked shell/budget-store.js — no real fs), correctly rejects
// locally (no network call) when the persisted global/agent limit would be exceeded,
// and correctly computes the updated ledger to write back on success.
import { test, mock } from "node:test";
import assert from "node:assert/strict";

let fixtureLedger = {
  version: 1,
  global: { limit: 1, spent: 0.95, calls: 10 },
  agents: {} as Record<string, { limit: number; spent: number; calls: number }>,
  updatedAt: "2026-07-08T00:00:00.000Z",
};
let writtenLedger: unknown;
let sdkCalled = false;

mock.module("../../src/shell/budget-store.js", {
  namedExports: {
    readLedger: () => fixtureLedger,
    writeLedgerAtomic: (ledger: unknown) => { writtenLedger = ledger; },
  },
});
mock.module("../../src/shell/wallet.js", {
  namedExports: {
    getClient: () => ({
      getWithPaymentRaw: async () => { sdkCalled = true; return { coingecko: { bitcoin: { usd: 1 } } }; },
    }),
  },
});

const { run } = await import("../../src/commands/defi.js");

function newBudget() {
  return { limit: null, spent: 0, calls: 0, agents: new Map() };
}

test("REQ-019c: within persisted headroom — call proceeds and the updated ledger is written back", async () => {
  fixtureLedger = { version: 1, global: { limit: 1, spent: 0.95, calls: 10 }, agents: {}, updatedAt: "2026-07-08T00:00:00.000Z" };
  writtenLedger = undefined;
  sdkCalled = false;
  // prices/coingecko:bitcoin costs $0.001 (REQ-171); $1 limit - $0.95 spent = $0.05 headroom.
  const res = await run({ path: "prices/coingecko:bitcoin" }, { json: true }, newBudget() as any);
  assert.equal(res.exitCode, 0);
  assert.equal(sdkCalled, true);
  assert.ok(writtenLedger, "the updated ledger must be written back after a successful settle");
  assert.equal((writtenLedger as any).global.spent, 0.951);
});

test("REQ-019c: exceeding persisted headroom — call is rejected locally, NO network call, ledger untouched", async () => {
  fixtureLedger = { version: 1, global: { limit: 1, spent: 0.9999, calls: 50 }, agents: {}, updatedAt: "2026-07-08T00:00:00.000Z" };
  writtenLedger = undefined;
  sdkCalled = false;
  // chains costs $0.005 (REQ-171); $1 - $0.9999 = $0.0001 headroom < $0.005 estimate.
  const res = await run({ path: "chains" }, { json: true }, newBudget() as any);
  assert.notEqual(res.exitCode, 0);
  assert.equal(sdkCalled, false, "no network call when the persisted cap would be exceeded");
  assert.equal(writtenLedger, undefined, "no ledger write on a locally-rejected call");
});

test("REQ-019c: per-agent persisted limit is enforced independently of the global limit", async () => {
  fixtureLedger = {
    version: 1,
    global: { limit: null, spent: 0, calls: 0 },
    agents: { research: { limit: 0.01, spent: 0.009, calls: 3 } },
    updatedAt: "2026-07-08T00:00:00.000Z",
  };
  writtenLedger = undefined;
  sdkCalled = false;
  const res = await run({ path: "chains", agentId: "research" }, { json: true }, newBudget() as any);
  assert.notEqual(res.exitCode, 0);
  assert.equal(sdkCalled, false);
});
