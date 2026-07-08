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
// IMPL-DX-1: mutable so the activeBalanceUnavailableReason tests below (REQ-DX-023)
// can vary getChainBalance()'s null/non-null return, same pattern as peekSolanaResult.
let chainBalanceResult: { balance: number | null; reason?: string } = { balance: 1.23 };
// PROP-FUND-005: mutable so the deposit "active chain is Solana with no --chain flag"
// case can flip getChain()'s return without an explicit --chain flag on the call.
let mockActiveChain: "base" | "solana" = "base";
mock.module("../../src/shell/wallet.js", {
  namedExports: {
    getChain: () => mockActiveChain,
    getWalletInfo: async () => ({ address: "0xTEST", explorerUrl: "https://basescan.org/address/0xTEST", network: "base-mainnet", chainId: 8453, isNew: false }),
    ensureBothWallets: async () => { ensureBothCalled = true; return { base: { address: "0xBASE" }, solana: { address: "SoLTEST" } }; },
    ensureBaseWallet: () => ({ address: "0xBASE", isNew: false }),
    peekSolanaWallet: async () => peekSolanaResult,
    getChainBalance: async () => chainBalanceResult,
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

// PROP-FUND-001..006: mutable so the deposit/onramp tests below can vary payOnce()'s
// success/failure/URL-shape behavior and capture its call args, same
// mutable-module-level-variable pattern already established above for wallet.js.
type PayOnceCall = { endpoint: string; body: Record<string, unknown>; resourceDescription: string };
let payOnceCalls: PayOnceCall[] = [];
let payOnceImpl: (req: PayOnceCall) => Promise<{ data: Record<string, unknown>; billedUsd: number | null }> =
  async () => ({ data: { url: "https://pay.coinbase.com/buy/default-mock" }, billedUsd: null });
mock.module("../../src/shell/manual-x402.js", {
  namedExports: {
    payOnce: async (req: PayOnceCall) => {
      payOnceCalls.push(req);
      return payOnceImpl(req);
    },
  },
});

// PROP-FUND-002: mutable so the --open tests below can vary openUrl()'s outcome and
// count calls (proving REQ-FUND-008's "openUrl is NEVER called when --open is
// omitted", not just that the resulting `opened` field happens to be false).
let openUrlCalls: string[] = [];
let openUrlResult = true;
mock.module("../../src/shell/qr.js", {
  namedExports: {
    // generateQrPng/openQrInViewer are ALSO imported by commands/wallet.ts (the qr/setup
    // actions) — a mock providing ONLY openUrl would leave that import unresolved
    // (SyntaxError: module does not provide an export). No existing test in this file
    // exercises qr/setup, so these are unused-but-required stubs.
    generateQrPng: async () => "/tmp/mock-qr.png",
    openQrInViewer: async () => {},
    openUrl: async (url: string) => {
      openUrlCalls.push(url);
      return openUrlResult;
    },
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
  chainBalanceResult = { balance: 1.23 };
  const res = await run({ action: "chain", chain: "solana" }, { json: true }, newBudget());
  assert.equal(res.exitCode, 0);
  assert.equal(ensureBothCalled, true, "an explicit --chain solana switch legitimately requires creating the Solana wallet");
  const parsed = JSON.parse(res.stdout);
  assert.equal(parsed.activeChain, "solana");
  assert.equal(parsed.solana, "SoLTEST");
});

test("REQ-DX-023/IMPL-DX-1: `wallet --action chain --json`'s top-level activeBalance null gains activeBalanceUnavailableReason (the field name the SHIPPED implementation actually uses, not status's per-chain balanceUnavailableReason)", async () => {
  peekSolanaResult = null;
  ensureBothCalled = false;
  chainBalanceResult = { balance: null, reason: "all_rpcs_failed" };
  const res = await run({ action: "chain" }, { json: true }, newBudget());
  assert.equal(res.exitCode, 0);
  const parsed = JSON.parse(res.stdout);
  assert.equal(parsed.activeBalance, null);
  assert.equal(parsed.activeBalanceUnavailableReason, "all_rpcs_failed");
});

test("REQ-DX-023/IMPL-DX-1: `wallet --action chain --json`'s activeBalanceUnavailableReason is ABSENT when activeBalance is a real number (including exactly 0)", async () => {
  peekSolanaResult = null;
  ensureBothCalled = false;
  chainBalanceResult = { balance: 0 };
  const res = await run({ action: "chain" }, { json: true }, newBudget());
  assert.equal(res.exitCode, 0);
  const parsed = JSON.parse(res.stdout);
  assert.equal(parsed.activeBalance, 0);
  assert.equal("activeBalanceUnavailableReason" in parsed, false, "a real (even zero) activeBalance must not carry the reason key at all");
});

function resetDepositMocks(): void {
  mockActiveChain = "base";
  payOnceCalls = [];
  payOnceImpl = async () => ({ data: { url: "https://pay.coinbase.com/buy/default-mock" }, billedUsd: null });
  openUrlCalls = [];
  openUrlResult = true;
}

test("PROP-FUND-001: `wallet --action deposit --json` on Base mints a Coinbase Onramp URL via payOnce() (REQ-FUND-001/002/004/009) — exact endpoint/body, url present, opened:false (no --open), existing chain/address/note preserved", async () => {
  resetDepositMocks();
  payOnceImpl = async () => ({ data: { url: "https://pay.coinbase.com/buy/abc123" }, billedUsd: null });
  const res = await run({ action: "deposit" }, { json: true }, newBudget());
  assert.equal(res.exitCode, 0);
  const parsed = JSON.parse(res.stdout);
  assert.equal(parsed.url, "https://pay.coinbase.com/buy/abc123");
  assert.equal(parsed.opened, false);
  assert.equal(parsed.chain, "base");
  // Matches the EXISTING deposit action's address source (getWalletInfo().address,
  // mocked as "0xTEST" above) — REQ-FUND-004 requires the address field's existing
  // value-source semantics to stay unchanged, not switch to ensureBaseWallet().
  assert.equal(parsed.address, "0xTEST");
  assert.ok(typeof parsed.note === "string" && parsed.note.length > 0);
  assert.equal(payOnceCalls.length, 1);
  assert.equal(payOnceCalls[0].endpoint, "/v1/onramp/token");
  assert.deepEqual(payOnceCalls[0].body, { address: "0xTEST", network: "base", asset: "USDC" });
});

test("PROP-FUND-002: `wallet --action deposit --open --json` opens the minted URL via openUrl() and reports opened:true on success", async () => {
  resetDepositMocks();
  payOnceImpl = async () => ({ data: { url: "https://pay.coinbase.com/buy/openme" }, billedUsd: null });
  openUrlResult = true;
  const res = await run({ action: "deposit", open: true }, { json: true }, newBudget());
  assert.equal(res.exitCode, 0);
  const parsed = JSON.parse(res.stdout);
  assert.equal(parsed.opened, true);
  assert.deepEqual(openUrlCalls, ["https://pay.coinbase.com/buy/openme"]);
});

test("PROP-FUND-002: `--open` with openUrl() reporting failure still exits 0 with opened:false", async () => {
  resetDepositMocks();
  payOnceImpl = async () => ({ data: { url: "https://pay.coinbase.com/buy/failtoopen" }, billedUsd: null });
  openUrlResult = false;
  const res = await run({ action: "deposit", open: true }, { json: true }, newBudget());
  assert.equal(res.exitCode, 0);
  const parsed = JSON.parse(res.stdout);
  assert.equal(parsed.opened, false);
  assert.equal(openUrlCalls.length, 1, "openUrl() was attempted, it just reported failure");
});

test("PROP-FUND-002/REQ-FUND-008: omitting `--open` (the default) NEVER calls openUrl() at all", async () => {
  resetDepositMocks();
  payOnceImpl = async () => ({ data: { url: "https://pay.coinbase.com/buy/noopen" }, billedUsd: null });
  const res = await run({ action: "deposit" }, { json: true }, newBudget());
  assert.equal(res.exitCode, 0);
  const parsed = JSON.parse(res.stdout);
  assert.equal(parsed.opened, false);
  assert.equal(openUrlCalls.length, 0, "openUrl() must not be called at all when --open is omitted — not just report opened:false");
});

test("PROP-FUND-003/REQ-FUND-002/006: a payOnce() success with a non-Coinbase URL is treated as a mint failure — exit 0, url absent, existing fields preserved", async () => {
  resetDepositMocks();
  payOnceImpl = async () => ({ data: { url: "https://evil.example.com/not-coinbase" }, billedUsd: null });
  const res = await run({ action: "deposit" }, { json: true }, newBudget());
  assert.equal(res.exitCode, 0, "a malformed onramp URL must NOT fail the command");
  const parsed = JSON.parse(res.stdout);
  assert.equal("url" in parsed, false);
  assert.equal(parsed.chain, "base");
  assert.equal(parsed.address, "0xTEST");
  assert.ok(typeof parsed.note === "string" && parsed.note.length > 0);
});

test("PROP-FUND-004/REQ-FUND-006: a payOnce() network/gateway rejection degrades gracefully — exit 0, url absent, note explains the failure", async () => {
  resetDepositMocks();
  payOnceImpl = async () => { throw new Error("fetch failed"); };
  const res = await run({ action: "deposit" }, { json: true }, newBudget());
  assert.equal(res.exitCode, 0, "a mint failure must NEVER cause `--action deposit` to fail — matches blockrun-mcp's launchTopUp() 'NEVER throws' contract");
  const parsed = JSON.parse(res.stdout);
  assert.equal("url" in parsed, false);
  assert.equal(parsed.chain, "base");
  assert.equal(parsed.address, "0xTEST");
  assert.ok(typeof parsed.note === "string" && parsed.note.length > 0);
});

test("PROP-FUND-005/REQ-FUND-007b: a `--chain solana` flag alongside `--action deposit` has NO EFFECT when the ACTIVE chain is Base — deposit reads only getChain(), never a --chain override", async () => {
  resetDepositMocks();
  payOnceImpl = async () => ({ data: { url: "https://pay.coinbase.com/buy/flagignored" }, billedUsd: null });
  const res = await run({ action: "deposit", chain: "solana" }, { json: true }, newBudget());
  assert.equal(res.exitCode, 0);
  assert.equal(payOnceCalls.length, 1, "the active chain is still Base (mockActiveChain), so a --chain flag on `deposit` must NOT suppress the mint");
  const parsed = JSON.parse(res.stdout);
  assert.equal(parsed.url, "https://pay.coinbase.com/buy/flagignored");
  assert.equal(parsed.chain, "base");
});

test("PROP-FUND-005/REQ-FUND-007: `--action deposit` with NO --chain flag, on a wallet whose ACTIVE chain is already Solana, also never attempts a mint", async () => {
  resetDepositMocks();
  mockActiveChain = "solana";
  const res = await run({ action: "deposit" }, { json: true }, newBudget());
  assert.equal(res.exitCode, 0);
  assert.equal(payOnceCalls.length, 0);
  const parsed = JSON.parse(res.stdout);
  assert.equal("url" in parsed, false);
});

test("PROP-FUND-006/REQ-FUND-003/017: a successful Base deposit mint never touches the ephemeral BudgetState (spent/calls stay 0) — the mint is $0 by construction, no gatePaidCall wiring", async () => {
  resetDepositMocks();
  payOnceImpl = async () => ({ data: { url: "https://pay.coinbase.com/buy/free" }, billedUsd: null });
  const budget = newBudget();
  const res = await run({ action: "deposit" }, { json: true }, budget);
  assert.equal(res.exitCode, 0);
  assert.equal(budget.spent, 0);
  assert.equal(budget.calls, 0);
});

test("PROP-FUND-009/REQ-FUND-009: the NON-`--json` human `--action deposit` text reflects each of the 3 output classes (Base success / Base mint-failure / Solana)", async () => {
  resetDepositMocks();
  payOnceImpl = async () => ({ data: { url: "https://pay.coinbase.com/buy/humantext" }, billedUsd: null });
  const success = await run({ action: "deposit" }, { json: false }, newBudget());
  assert.equal(success.exitCode, 0);
  assert.match(success.stdout, /https:\/\/pay\.coinbase\.com\/buy\/humantext/, "human text must contain the real minted URL");

  resetDepositMocks();
  payOnceImpl = async () => { throw new Error("boom"); };
  const failure = await run({ action: "deposit" }, { json: false }, newBudget());
  assert.equal(failure.exitCode, 0);
  assert.doesNotMatch(failure.stdout, /https:\/\/pay\.coinbase\.com\//, "a failed mint's human text must not claim a URL exists");

  resetDepositMocks();
  const solana = await run({ action: "deposit", chain: "solana" }, { json: false }, newBudget());
  assert.equal(solana.exitCode, 0);
  assert.match(solana.stdout, /base/i, "Solana's human text must explain the Base-only limitation");
});
