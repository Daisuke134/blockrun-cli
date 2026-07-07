// Run with: npm test (tsx --test --experimental-test-module-mocks)
// PROP-108 (REQ-120–122). Mocks the model-catalog loader so no network fetch happens.
import { test, mock } from "node:test";
import assert from "node:assert/strict";

mock.module("../../src/shell/wallet.js", { namedExports: { getClient: () => ({}) } });
mock.module("../../src/shell/model-cache.js", {
  namedExports: {
    loadModels: async () => [
      { id: "openai/gpt-5.5", categories: ["chat"] },
      { id: "openai/gpt-image-2", type: "image", pricePerImage: 0.06 },
    ],
  },
});

const { run } = await import("../../src/commands/models.js");

test("REQ-121: models is free — never touches the budget ledger", async () => {
  const budget = { limit: null, spent: 0, calls: 0, agents: new Map() };
  const res = await run({ category: "all" }, { json: true }, budget as any);
  assert.equal(res.exitCode, 0);
  assert.equal(budget.spent, 0);
});

test("REQ-120: category=image filters to image-typed models only", async () => {
  const budget = { limit: null, spent: 0, calls: 0, agents: new Map() };
  const res = await run({ category: "image" }, { json: true }, budget as any);
  const parsed = JSON.parse(res.stdout);
  assert.equal(parsed.count, 1);
  assert.equal(parsed.models[0].id, "openai/gpt-image-2");
});
