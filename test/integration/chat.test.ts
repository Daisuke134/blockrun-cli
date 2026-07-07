// Run with: npm test (tsx --test --experimental-test-module-mocks)
// PROP-105 (REQ-108–119). Mocks src/shell/wallet.js's buildClient() so no real LLM call
// happens; asserts the mock is invoked with the correctly-mapped request and the
// stdout/exit-code contract holds.
import { test, mock } from "node:test";
import assert from "node:assert/strict";
import type { BudgetState } from "../../src/types.js";

let lastChatArgs: unknown[] = [];
const fakeLlm = {
  chat: async (...args: unknown[]) => { lastChatArgs = args; return "42"; },
  getSpending: () => ({ totalUsd: 0 }),
};
mock.module("../../src/shell/wallet.js", {
  namedExports: {
    buildClient: () => fakeLlm,
    getChain: () => "base",
  },
});

const { run } = await import("../../src/commands/chat.js");

function newBudget(limit: number | null = null): BudgetState {
  return { limit, spent: 0, calls: 0, agents: new Map() };
}

test("REQ-109/REQ-119: an explicit --model call dispatches llm.chat(model, message, ...) and reports the real response", async () => {
  const budget = newBudget();
  const res = await run({ message: "2+2?", model: "nvidia/deepseek-v4-flash" }, { json: true }, budget);
  assert.equal(res.exitCode, 0);
  assert.equal(lastChatArgs[0], "nvidia/deepseek-v4-flash");
  assert.equal(lastChatArgs[1], "2+2?");
  const parsed = JSON.parse(res.stdout);
  assert.match(parsed.response ?? parsed.text ?? JSON.stringify(parsed), /42/);
});

test("REQ-020/REQ-009: a budget-exceeded gate returns nonzero exit and a JSON error object, no network call", async () => {
  const budget = newBudget(0); // $0 cap
  lastChatArgs = [];
  const res = await run({ message: "hi", model: "openai/gpt-5.5" }, { json: true }, budget);
  assert.notEqual(res.exitCode, 0);
  assert.deepEqual(lastChatArgs, [], "the gate must block BEFORE any SDK call");
  const parsed = JSON.parse(res.stdout);
  assert.equal(parsed.error, true);
});

test("REQ-118: routing:smart + messages is rejected before any network call", async () => {
  const budget = newBudget();
  lastChatArgs = [];
  const res = await run({ message: "hi", routing: "smart", messages: [{ role: "user", content: "x" }] }, { json: false }, budget);
  assert.notEqual(res.exitCode, 0);
  assert.deepEqual(lastChatArgs, []);
});
