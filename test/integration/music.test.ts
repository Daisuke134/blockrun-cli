// Run with: npm test (tsx --test --experimental-test-module-mocks)
// PROP-120 (REQ-144–147). Mocks payAndPoll() for both the inline-fast and async-slow
// paths (both collapse to the same mocked function here; the distinction is exercised
// by the real 402/202 status codes at Tier 3).
import { test, mock } from "node:test";
import assert from "node:assert/strict";
import type { BudgetState } from "../../src/types.js";

mock.module("../../src/shell/manual-x402.js", {
  namedExports: {
    payAndPoll: async () => ({ data: { url: "https://blockrun.ai/media/fake.mp3", duration_seconds: 180 }, billedUsd: 0.1575, txHash: "0xabc" }),
  },
});
mock.module("../../src/shell/wallet.js", { namedExports: { getChain: () => "base", getOrCreateWalletKey: () => "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" } });

const { run } = await import("../../src/commands/music.js");

function newBudget(): BudgetState {
  return { limit: null, spent: 0, calls: 0, agents: new Map() };
}

test("REQ-147: reports the real settled 402-quoted cost", async () => {
  const budget = newBudget();
  const res = await run({ prompt: "lo-fi beats" }, { json: true }, budget);
  assert.equal(res.exitCode, 0);
  const parsed = JSON.parse(res.stdout);
  assert.equal(parsed.cost_usd, 0.1575);
  assert.equal(budget.spent, 0.1575);
});

test("REQ-145: instrumental (default true) + lyrics is rejected before any network call", async () => {
  const budget = newBudget();
  const res = await run({ prompt: "lo-fi beats", lyrics: "la la la" }, { json: true }, budget);
  assert.notEqual(res.exitCode, 0);
  assert.equal(budget.spent, 0);
});
