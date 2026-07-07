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
