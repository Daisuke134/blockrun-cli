// Run with: npm test (tsx --test --experimental-test-module-mocks)
// PROP-102 (REQ-101–107). Mocks src/shell/wallet.js so `wallet status` never touches a
// real key/network, then asserts the command's stdout/exit-code contract (REQ-006–009)
// and that wallet actions never touch the budget ledger (REQ-107).
import { test, mock } from "node:test";
import assert from "node:assert/strict";
import type { BudgetState } from "../../src/types.js";

mock.module("../../src/shell/wallet.js", {
  namedExports: {
    getChain: () => "base",
    getWalletInfo: async () => ({ address: "0xTEST", explorerUrl: "https://basescan.org/address/0xTEST", network: "base-mainnet", chainId: 8453, isNew: false }),
    ensureBothWallets: async () => ({ base: { address: "0xBASE" }, solana: { address: "SoLTEST" } }),
    getChainBalance: async () => 1.23,
    setChain: () => {},
  },
});

// Stand-in for the real ~/.blockrun/cli-budget.json (REQ-019/REQ-107a): a module-level
// variable simulates the file's persistence ACROSS separate run() calls, which is the
// Tier-2 proxy for PROP-103's real two-separate-CLI-process Tier-3 proof.
let persistedStore: any = { version: 1, global: { limit: null, spent: 0, calls: 0 }, agents: {}, updatedAt: "2026-07-08T00:00:00.000Z" };
mock.module("../../src/shell/budget-store.js", {
  namedExports: {
    readLedger: () => persistedStore,
    writeLedgerAtomic: (ledger: unknown) => { persistedStore = ledger; },
  },
});

const { run } = await import("../../src/commands/wallet.js");

function newBudget(): BudgetState {
  return { limit: null, spent: 0, calls: 0, agents: new Map() };
}

test("REQ-105/REQ-006: `wallet status --json` prints one parseable JSON document with both chain addresses", async () => {
  const budget = newBudget();
  const res = await run({ action: "status" }, { json: true }, budget);
  assert.equal(res.exitCode, 0);
  const parsed = JSON.parse(res.stdout);
  assert.equal(parsed.base.address, "0xBASE");
  assert.equal(parsed.solana.address, "SoLTEST");
});

test("REQ-107: wallet actions never reserve or spend against the budget ledger", async () => {
  const budget = newBudget();
  await run({ action: "status" }, { json: true }, budget);
  assert.equal(budget.spent, 0);
  assert.equal(budget.calls, 0);
});

test("REQ-106: `wallet delegate` without agent-id fails locally with a nonzero exit and no network call", async () => {
  const budget = newBudget();
  const res = await run({ action: "delegate" }, { json: true }, budget);
  assert.notEqual(res.exitCode, 0);
  const parsed = JSON.parse(res.stdout);
  assert.equal(parsed.error, true);
});

test("REQ-107a/REQ-019: `delegate` in one invocation persists, and `report` in a SEPARATE (later) invocation reflects it", async () => {
  persistedStore = { version: 1, global: { limit: null, spent: 0, calls: 0 }, agents: {}, updatedAt: "2026-07-08T00:00:00.000Z" };
  const invocationA = await run({ action: "delegate", agentId: "research", agentLimit: 2 }, { json: true }, newBudget());
  assert.equal(invocationA.exitCode, 0);

  // A genuinely SEPARATE run() call (own fresh in-memory BudgetState, standing in for a
  // separate OS process per PROP-103) — persistence must come from persistedStore, not
  // from any in-process state carried over.
  const invocationB = await run({ action: "report" }, { json: true }, newBudget());
  assert.equal(invocationB.exitCode, 0);
  const parsed = JSON.parse(invocationB.stdout);
  assert.equal(parsed.agents.research.limit, 2);
});
