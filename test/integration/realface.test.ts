// Run with: npm test (tsx --test --experimental-test-module-mocks)
// PROP-117 (REQ-137–143). init/status/list go through the free fetchJson() helper;
// enroll/portrait go through payOnce() (decisions.md §6).
import { test, mock } from "node:test";
import assert from "node:assert/strict";
import type { BudgetState } from "../../src/types.js";

mock.module("../../src/shell/http.js", {
  namedExports: {
    fetchJson: async (url: string) => {
      if (url.includes("/init")) return { status: 200, data: { group_id: "legacy_rf_1", status: "pending", h5_link: "https://x/qr" } };
      if (url.includes("/status")) return { status: 200, data: { group_id: "legacy_rf_1", status: "active", ready_to_finalize: true, asset_count: 1 } };
      return { status: 200, data: { realfaces: [], portraits: [] } };
    },
  },
});
mock.module("../../src/shell/manual-x402.js", {
  namedExports: {
    payOnce: async () => ({ data: { asset_id: "ta_fake123", name: "Zed" }, billedUsd: 0.01, txHash: "0xabc" }),
  },
});
mock.module("../../src/shell/wallet.js", { namedExports: { getChain: () => "base", getOrCreateWalletKey: () => "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" } });
mock.module("../../src/shell/qr.js", { namedExports: { generateUrlQrPng: async () => "/tmp/fake-qr.png", openQrInViewer: async () => {} } });

const { run } = await import("../../src/commands/realface.js");

function newBudget(): BudgetState {
  return { limit: null, spent: 0, calls: 0, agents: new Map() };
}

test("REQ-138: init is free and returns the group_id", async () => {
  const budget = newBudget();
  const res = await run({ action: "init", name: "Alice" }, { json: true }, budget);
  assert.equal(res.exitCode, 0);
  assert.equal(budget.spent, 0);
  const parsed = JSON.parse(res.stdout);
  assert.equal(parsed.group_id, "legacy_rf_1");
});

test("REQ-141: portrait ($0.01) reports the real settled cost", async () => {
  const budget = newBudget();
  const res = await run({ action: "portrait", name: "Zed", imageUrl: "https://x/z.png" }, { json: true }, budget);
  assert.equal(res.exitCode, 0);
  assert.equal(budget.spent, 0.01);
  const parsed = JSON.parse(res.stdout);
  assert.equal(parsed.asset_id, "ta_fake123");
});
