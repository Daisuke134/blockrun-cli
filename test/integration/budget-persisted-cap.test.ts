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

// Set by the concurrent-write regression test below to make readLedger() return a
// DIFFERENT snapshot on its second call within one run() — simulating another CLI
// invocation writing to the ledger between this call's gate-open and its settle.
// A mutable closure variable (not a reassigned export) since mock.module()'s
// namedExports functions are the only legal seam for varying a mock's return value
// per-test — the imported module namespace itself is a frozen ES module object.
let concurrentWriteLedger: typeof fixtureLedger | undefined;
let readCount = 0;

mock.module("../../src/shell/budget-store.js", {
  namedExports: {
    readLedger: () => {
      readCount += 1;
      if (concurrentWriteLedger && readCount >= 2) return concurrentWriteLedger;
      return fixtureLedger;
    },
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

test("codex-impl-review-1 #2: commit re-reads the ledger FRESH — a concurrent write between gate-open and settle is not clobbered", async () => {
  // Simulates another CLI invocation (e.g. a concurrent paid call, or a wallet
  // delegate/budget-set) writing to the ledger AFTER this call's gate opened but
  // BEFORE it settles — readLedger returns a DIFFERENT snapshot on its second call
  // (see the readLedger mock above: concurrentWriteLedger kicks in from the 2nd read).
  fixtureLedger = { version: 1, global: { limit: null, spent: 0, calls: 0 }, agents: {}, updatedAt: "2026-07-08T00:00:00.000Z" };
  concurrentWriteLedger = { version: 1, global: { limit: null, spent: 0.5, calls: 7 }, agents: {}, updatedAt: "2026-07-08T00:05:00.000Z" };
  readCount = 0;
  writtenLedger = undefined;
  sdkCalled = false;
  try {
    const res = await run({ path: "prices/coingecko:bitcoin" }, { json: true }, newBudget() as any);
    assert.equal(res.exitCode, 0);
    assert.equal(sdkCalled, true);
    assert.ok(readCount >= 2, "readLedger must be called again at commit time, not just once at gate-open");
    assert.ok(writtenLedger, "the updated ledger must be written back after a successful settle");
    // 0.5 (the CONCURRENT baseline read at commit time) + 0.001 (this call's real
    // spend) — NOT 0 + 0.001, which is what a stale-snapshot write would produce.
    assert.equal((writtenLedger as any).global.spent, 0.501, "commit must apply the delta on top of the FRESH ledger, not the stale gate-open snapshot");
  } finally {
    concurrentWriteLedger = undefined;
  }
});
