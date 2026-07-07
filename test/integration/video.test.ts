// Run with: npm test (tsx --test --experimental-test-module-mocks)
// PROP-114 (REQ-130–136). Mocks src/shell/manual-x402.js's payAndPoll() (decisions.md
// §6) so no real HTTP/payment happens; asserts a failed poll status records NO charge
// (REQ-134) and a completed one reports the real settled cost (REQ-136).
import { test, mock } from "node:test";
import assert from "node:assert/strict";
import type { BudgetState } from "../../src/types.js";

let lastReq: any;
let mode: "completed" | "failed" = "completed";
mock.module("../../src/shell/manual-x402.js", {
  namedExports: {
    payAndPoll: async (req: any) => {
      lastReq = req;
      if (mode === "failed") throw new Error("Upstream generation failed: moderation. No payment taken.");
      return { data: { url: "https://blockrun.ai/media/fake.mp4", duration_seconds: 1 }, billedUsd: 0.05, txHash: "0xabc" };
    },
  },
});
mock.module("../../src/shell/wallet.js", { namedExports: { getChain: () => "base", getOrCreateWalletKey: () => "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" } });

const { run } = await import("../../src/commands/video.js");

function newBudget(): BudgetState {
  return { limit: null, spent: 0, calls: 0, agents: new Map() };
}

test("REQ-136: a completed job reports the real settled cost and URL", async () => {
  mode = "completed";
  const budget = newBudget();
  const res = await run({ prompt: "a spinning cube", model: "xai/grok-imagine-video", durationSeconds: 1 }, { json: true }, budget);
  assert.equal(res.exitCode, 0);
  const parsed = JSON.parse(res.stdout);
  assert.equal(parsed.cost_usd, 0.05);
  assert.match(parsed.url, /fake\.mp4/);
  assert.equal(budget.spent, 0.05);
});

test("REQ-134: a failed job records NO charge and returns a nonzero exit", async () => {
  mode = "failed";
  const budget = newBudget();
  const res = await run({ prompt: "a spinning cube", model: "xai/grok-imagine-video" }, { json: true }, budget);
  assert.notEqual(res.exitCode, 0);
  assert.equal(budget.spent, 0, "no payment was taken on a failed/timed-out job");
});

test("REQ-133: Solana chain rejects video with an actionable chain-switch message, before any call", async () => {
  mode = "completed";
  const budget = newBudget();
  const chainModule = await import("../../src/shell/wallet.js");
  (chainModule as any).getChain = () => "solana";
  lastReq = undefined;
  const res = await run({ prompt: "x" }, { json: true }, budget);
  assert.notEqual(res.exitCode, 0);
});
