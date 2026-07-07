// Run with: npm test (tsx --test --experimental-test-module-mocks)
// PROP-111 (REQ-123–129). Mirrors blockrun-mcp's own image-cost.test.ts mocking idiom:
// mock.module the wallet shell BEFORE importing the command, so the paid ImageClient
// and chain selector are fully faked (no network, no payment).
import { test, mock } from "node:test";
import assert from "node:assert/strict";
import type { BudgetState } from "../../src/types.js";

const fakeImageClient = {
  generate: async () => ({ data: [{ url: "https://blockrun.ai/media/fake.png" }] }),
  edit: async () => ({ data: [{ url: "https://blockrun.ai/media/fake-edit.png" }] }),
};
mock.module("../../src/shell/wallet.js", {
  namedExports: {
    getChain: () => "base",
    getImageClient: () => fakeImageClient,
  },
});

const { run } = await import("../../src/commands/image.js");

function newBudget(): BudgetState {
  return { limit: null, spent: 0, calls: 0, agents: new Map() };
}

test("REQ-129/REQ-006: generate reports the model's catalog cost in JSON output", async () => {
  const budget = newBudget();
  const res = await run({ prompt: "a red cube", model: "openai/gpt-image-2", size: "1024x1024" }, { json: true }, budget);
  assert.equal(res.exitCode, 0);
  const parsed = JSON.parse(res.stdout);
  assert.equal(parsed.cost_usd, 0.06);
  assert.equal(budget.spent, 0.06);
});

test("REQ-126: edit without --image fails locally, no SDK call, nonzero exit", async () => {
  const budget = newBudget();
  const res = await run({ prompt: "a red cube", action: "edit" }, { json: true }, budget);
  assert.notEqual(res.exitCode, 0);
  assert.equal(budget.spent, 0, "no charge on a locally-rejected call");
});
