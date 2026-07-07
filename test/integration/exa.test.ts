// Run with: npm test (tsx --test --experimental-test-module-mocks)
// PROP-129 (REQ-154–155). Mocks getClient()'s requestWithPaymentRaw per path.
import { test, mock } from "node:test";
import assert from "node:assert/strict";
import type { BudgetState } from "../../src/types.js";

let lastEndpoint: string | undefined;
let lastBody: unknown;
mock.module("../../src/shell/wallet.js", {
  namedExports: {
    getClient: () => ({
      requestWithPaymentRaw: async (endpoint: string, body: unknown) => {
        lastEndpoint = endpoint;
        lastBody = body;
        return { results: [{ url: "https://blockrun.ai", text: "hi" }] };
      },
    }),
  },
});

const { run } = await import("../../src/commands/exa.js");

function newBudget(): BudgetState {
  return { limit: null, spent: 0, calls: 0, agents: new Map() };
}

test("REQ-155: contents with 1 URL charges $0.002 and hits /v1/exa/contents", async () => {
  const budget = newBudget();
  const res = await run({ path: "contents", body: { urls: ["https://blockrun.ai"] } }, { json: true }, budget);
  assert.equal(res.exitCode, 0);
  assert.equal(budget.spent, 0.002);
  assert.match(lastEndpoint!, /\/v1\/exa\/contents$/);
});

test("REQ-154a/PROP-206: the --query alias form reaches the SDK with the SAME body as the canonical --body form (answer path)", async () => {
  const budget1 = newBudget();
  await run({ path: "answer", query: "what is x402?" }, { json: true }, budget1);
  const viaAlias = { ...(lastBody as any) };

  const budget2 = newBudget();
  await run({ path: "answer", body: { query: "what is x402?" } }, { json: true }, budget2);
  const viaCanonical = { ...(lastBody as any) };

  assert.deepEqual(viaAlias, viaCanonical);
});
