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
  smartChat: async (message: string, opts: Record<string, unknown>) => {
    lastSmartChatArgs = [message, opts];
    return { model: "openai/gpt-5.5", response: "smart reply", routing: { tier: "auto", costEstimate: 0.01, savings: 0.4 } };
  },
  getSpending: () => ({ totalUsd: 0 }),
};
// Mutable so per-test overrides (Solana guard, smart-routing, native-Anthropic) don't
// require illegally reassigning a property on a non-writable ES module namespace
// object — same pattern as test/integration/video.test.ts's activeChain.
let activeChain: "base" | "solana" = "base";
let lastSmartChatArgs: unknown[] = [];
let lastAnthropicCreateArgs: unknown;
const fakeAnthropicClient = {
  messages: {
    create: async (args: unknown) => {
      lastAnthropicCreateArgs = args;
      return {
        model: "claude-opus-4-8",
        content: [
          { type: "thinking", thinking: "Let me work through 2+2...", signature: "sig_abc123verbatim" },
          { type: "text", text: "4" },
        ],
        usage: { input_tokens: 10, output_tokens: 20 },
      };
    },
  },
};
mock.module("../../src/shell/wallet.js", {
  namedExports: {
    buildClient: () => fakeLlm,
    getChain: () => activeChain,
    getAnthropicClient: () => fakeAnthropicClient,
  },
});

const { run } = await import("../../src/commands/chat.js");

function newBudget(limit: number | null = null): BudgetState {
  return { limit, spent: 0, calls: 0, agents: new Map() };
}

test("REQ-109/REQ-119: an explicit --model call dispatches llm.chat(model, message, ...) and reports the real response", async () => {
  activeChain = "base";
  const budget = newBudget();
  const res = await run({ message: "2+2?", model: "nvidia/deepseek-v4-flash" }, { json: true }, budget);
  assert.equal(res.exitCode, 0);
  assert.equal(lastChatArgs[0], "nvidia/deepseek-v4-flash");
  assert.equal(lastChatArgs[1], "2+2?");
  const parsed = JSON.parse(res.stdout);
  assert.match(parsed.response ?? parsed.text ?? JSON.stringify(parsed), /42/);
});

test("REQ-020/REQ-009: a budget-exceeded gate returns nonzero exit and a JSON error object, no network call", async () => {
  activeChain = "base";
  const budget = newBudget(0); // $0 cap
  lastChatArgs = [];
  const res = await run({ message: "hi", model: "openai/gpt-5.5" }, { json: true }, budget);
  assert.notEqual(res.exitCode, 0);
  assert.deepEqual(lastChatArgs, [], "the gate must block BEFORE any SDK call");
  const parsed = JSON.parse(res.stdout);
  assert.equal(parsed.error, true);
});

test("REQ-118: routing:smart + messages is rejected before any network call", async () => {
  activeChain = "base";
  const budget = newBudget();
  lastChatArgs = [];
  const res = await run({ message: "hi", routing: "smart", messages: [{ role: "user", content: "x" }] }, { json: false }, budget);
  assert.notEqual(res.exitCode, 0);
  assert.deepEqual(lastChatArgs, []);
});

test("REQ-108a: a bare positional message reaches the SDK call identically to --message", async () => {
  activeChain = "base";
  const budget = newBudget();
  lastChatArgs = [];
  const res = await run({ $positional: ["2+2?"], model: "nvidia/deepseek-v4-flash" }, { json: true }, budget);
  assert.equal(res.exitCode, 0);
  assert.equal(lastChatArgs[1], "2+2?");
});

test("REQ-022/PROP-205: --agent-id reaches per-agent accounting — even a $0 (nvidia) call increments that agent's call count", async () => {
  activeChain = "base";
  const budget = newBudget();
  budget.agents.set("research", { limit: 0.001, spent: 0, calls: 0 });
  const res = await run({ message: "hi", model: "nvidia/deepseek-v4-flash", agentId: "research" }, { json: true }, budget);
  assert.equal(res.exitCode, 0);
  assert.equal(budget.agents.get("research")!.calls, 1, "the call must be recorded against the 'research' agent specifically, proving agent_id reached the recordActualSpend call");
});

// ── REQ-111/REQ-112/REQ-118 (routing:"smart") ──────────────────────────────────────

test("REQ-111/REQ-112: routing:smart dispatches llm.smartChat(message, options) with routing_profile threaded through", async () => {
  activeChain = "base";
  const budget = newBudget();
  lastSmartChatArgs = [];
  const res = await run({ message: "what's 2+2?", routing: "smart", routingProfile: "premium" }, { json: true }, budget);
  assert.equal(res.exitCode, 0, `expected success\nstdout:${res.stdout}`);
  assert.equal(lastSmartChatArgs[0], "what's 2+2?");
  assert.equal((lastSmartChatArgs[1] as any).routingProfile, "premium");
  const parsed = JSON.parse(res.stdout);
  assert.match(parsed.response ?? JSON.stringify(parsed), /smart reply/);
});

test('REQ-112: routing:smart routing_profile:"free" maps to undefined (the SDK dropped the free profile), not a literal "free" string', async () => {
  activeChain = "base";
  const budget = newBudget();
  lastSmartChatArgs = [];
  await run({ message: "hi", routing: "smart", routingProfile: "free" }, { json: true }, budget);
  assert.equal((lastSmartChatArgs[1] as any).routingProfile, undefined);
});

test("REQ-118: routing:smart on Solana fails with an actionable message, no network call", async () => {
  activeChain = "solana";
  const budget = newBudget();
  lastSmartChatArgs = [];
  try {
    const res = await run({ message: "hi", routing: "smart" }, { json: true }, budget);
    assert.notEqual(res.exitCode, 0);
    assert.deepEqual(lastSmartChatArgs, [], "smartChat must never be called on Solana");
    const parsed = JSON.parse(res.stdout);
    assert.match(parsed.message, /Solana/i);
  } finally {
    activeChain = "base";
  }
});

// ── REQ-117 (native anthropic/claude-* passthrough) ────────────────────────────────

test("REQ-117: an anthropic/claude-* model routes NATIVELY to messages.create (not llm.chat), Base-only", async () => {
  activeChain = "base";
  const budget = newBudget();
  lastChatArgs = [];
  lastAnthropicCreateArgs = undefined;
  const res = await run({ message: "2+2?", model: "anthropic/claude-opus-4.8" }, { json: true }, budget);
  assert.equal(res.exitCode, 0, `expected success\nstdout:${res.stdout}`);
  assert.ok(lastAnthropicCreateArgs, "messages.create must have been called");
  assert.deepEqual(lastChatArgs, [], "the OpenAI-compat llm.chat() path must NOT be used for a native anthropic/claude-* model");
  assert.equal((lastAnthropicCreateArgs as any).model, "anthropic/claude-opus-4.8");
});

test("REQ-114/REQ-114a: --thinking-budget-tokens compiles into the native request's thinking object", async () => {
  activeChain = "base";
  const budget = newBudget();
  lastAnthropicCreateArgs = undefined;
  await run({ message: "2+2?", model: "anthropic/claude-opus-4.8", thinkingBudgetTokens: 2000 }, { json: true }, budget);
  assert.deepEqual((lastAnthropicCreateArgs as any).thinking, { type: "enabled", budget_tokens: 2000 });
});

test("REQ-117: the native response's thinking block AND its signature are preserved verbatim in the CLI's output (not stripped/regenerated)", async () => {
  activeChain = "base";
  const budget = newBudget();
  const res = await run({ message: "2+2?", model: "anthropic/claude-opus-4.8", thinkingBudgetTokens: 2000 }, { json: true }, budget);
  assert.equal(res.exitCode, 0);
  const parsed = JSON.parse(res.stdout);
  const serialized = JSON.stringify(parsed);
  assert.match(serialized, /sig_abc123verbatim/, "the thinking block's signature must appear verbatim in the --json output, per REQ-117's 'verbatim thinking blocks/signatures'");
});

test("REQ-117: native anthropic on Solana fails with an actionable chain-switch message, no network call", async () => {
  activeChain = "solana";
  const budget = newBudget();
  lastAnthropicCreateArgs = undefined;
  try {
    const res = await run({ message: "2+2?", model: "anthropic/claude-opus-4.8" }, { json: true }, budget);
    assert.notEqual(res.exitCode, 0);
    assert.equal(lastAnthropicCreateArgs, undefined, "messages.create must never be called on Solana");
    const parsed = JSON.parse(res.stdout);
    assert.match(parsed.message, /Solana/i);
  } finally {
    activeChain = "base";
  }
});
