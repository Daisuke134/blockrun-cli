// Run with: npm test (tsx --test --experimental-test-module-mocks)
// PROP-102 (REQ-101–107). Mocks src/shell/wallet.js so `wallet status` never touches a
// real key/network, then asserts the command's stdout/exit-code contract (REQ-006–009)
// and that wallet actions never touch the budget ledger (REQ-107).
import { test, mock } from "node:test";
import assert from "node:assert/strict";
import type { BudgetState } from "../../src/types.js";

// Mutable so the REQ-016a "chain" tests below can vary whether a Solana wallet
// already exists, without illegally reassigning a property on a (non-writable) ES
// module namespace object — same pattern used elsewhere in this suite.
let peekSolanaResult: { address: string } | null = null;
let ensureBothCalled = false;
mock.module("../../src/shell/wallet.js", {
  namedExports: {
    getChain: () => "base",
    getWalletInfo: async () => ({ address: "0xTEST", explorerUrl: "https://basescan.org/address/0xTEST", network: "base-mainnet", chainId: 8453, isNew: false }),
    ensureBothWallets: async () => { ensureBothCalled = true; return { base: { address: "0xBASE" }, solana: { address: "SoLTEST" } }; },
    ensureBaseWallet: () => ({ address: "0xBASE", isNew: false }),
    peekSolanaWallet: async () => peekSolanaResult,
    getChainBalance: async () => ({ balance: 1.23 }),
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

test("REQ-105/REQ-006: `wallet status --json` prints one parseable JSON document with both chain addresses (when a Solana wallet already exists)", async () => {
  peekSolanaResult = { address: "SoLTEST" }; // simulates a Solana wallet already on disk
  const budget = newBudget();
  const res = await run({ action: "status" }, { json: true }, budget);
  assert.equal(res.exitCode, 0);
  const parsed = JSON.parse(res.stdout);
  assert.equal(parsed.base.address, "0xBASE");
  assert.equal(parsed.solana.address, "SoLTEST");
});

test("REQ-016a: `wallet status` PEEKS for an existing Solana wallet, never creates one — reports null when none exists yet", async () => {
  peekSolanaResult = null;
  ensureBothCalled = false;
  const budget = newBudget();
  const res = await run({ action: "status" }, { json: true }, budget);
  assert.equal(res.exitCode, 0);
  assert.equal(ensureBothCalled, false, "status (a Base-default/view-only operation) must never call ensureBothWallets(), which would create the Solana wallet as a side effect");
  const parsed = JSON.parse(res.stdout);
  assert.equal(parsed.base.address, "0xBASE");
  assert.equal(parsed.solana, null, "no Solana wallet exists yet, so its address must be reported as null, not fabricated by creating one");
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

test("REQ-016a: `wallet --action chain` (view-only, no --chain flag) PEEKS for an existing Solana wallet, never creates one", async () => {
  peekSolanaResult = null; // no Solana wallet exists yet
  ensureBothCalled = false;
  const res = await run({ action: "chain" }, { json: true }, newBudget());
  assert.equal(res.exitCode, 0);
  assert.equal(ensureBothCalled, false, "a view-only chain call must never call ensureBothWallets() (which would create the Solana wallet)");
  const parsed = JSON.parse(res.stdout);
  assert.equal(parsed.activeChain, "base");
  assert.equal(parsed.solana, null, "no Solana wallet exists yet, so its address must be reported as null, not fabricated");
});

test("REQ-016a: `wallet --action chain` (view-only) reports the Solana address WHEN one already exists, still without creating it", async () => {
  peekSolanaResult = { address: "SoLEXISTING" };
  ensureBothCalled = false;
  const res = await run({ action: "chain" }, { json: true }, newBudget());
  assert.equal(res.exitCode, 0);
  assert.equal(ensureBothCalled, false);
  const parsed = JSON.parse(res.stdout);
  assert.equal(parsed.solana, "SoLEXISTING");
});

test("REQ-016a: `wallet --action chain --chain solana` (explicit switch) DOES create the Solana wallet via ensureBothWallets()", async () => {
  peekSolanaResult = null;
  ensureBothCalled = false;
  const res = await run({ action: "chain", chain: "solana" }, { json: true }, newBudget());
  assert.equal(res.exitCode, 0);
  assert.equal(ensureBothCalled, true, "an explicit --chain solana switch legitimately requires creating the Solana wallet");
  const parsed = JSON.parse(res.stdout);
  assert.equal(parsed.activeChain, "solana");
  assert.equal(parsed.solana, "SoLTEST");
});
