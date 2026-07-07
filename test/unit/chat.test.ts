// Run with: npm test (tsx --test)
// PROP-104 (REQ-108–119). estimateChatCost is a verbatim port of chat.ts's
// estimateChatCost (verification-architecture.md §1.1 cost/chat.ts) — reuses the
// clone's own chat.test.ts assertions, extended for CLI flag defaults.
import { test } from "node:test";
import assert from "node:assert/strict";
import { estimateChatCost } from "../../src/core/cost/chat.js";
import { buildRequest } from "../../src/args/chat.js";

test("REQ-119: estimateChatCost reserves a non-zero amount for smart+free (paid model, no bypass)", () => {
  assert.ok(estimateChatCost(1024, undefined, undefined, "smart", "free") > 0);
});

test("estimateChatCost: smart+free reserves the same as smart+auto", () => {
  assert.equal(
    estimateChatCost(1024, undefined, undefined, "smart", "free"),
    estimateChatCost(1024, undefined, undefined, "smart", "auto"),
  );
});

test("REQ-114: estimateChatCost reserves for the extended-thinking budget, not just max_tokens", () => {
  const noThink = estimateChatCost(1024, undefined, "anthropic/claude-opus-4.8", undefined, undefined);
  const withThink = estimateChatCost(1024, undefined, "anthropic/claude-opus-4.8", undefined, undefined, 100_000);
  assert.ok(withThink > noThink * 10);
});

test("REQ-119: estimateChatCost keeps genuinely-free paths at $0", () => {
  assert.equal(estimateChatCost(1024, "free", undefined, undefined, undefined), 0);
  assert.equal(estimateChatCost(1024, undefined, "nvidia/deepseek-v4-flash", undefined, undefined), 0);
});

test("REQ-119: estimateChatCost reserves the frontier worst-case for balanced/coding", () => {
  const frontier = estimateChatCost(1024, "reasoning", undefined, undefined, undefined);
  assert.equal(estimateChatCost(1024, "balanced", undefined, undefined, undefined), frontier);
  assert.equal(estimateChatCost(1024, "coding", undefined, undefined, undefined), frontier);
});

test("REQ-119: estimateChatCost reserves the frontier worst-case for a no-mode chat", () => {
  const frontier = estimateChatCost(1024, "reasoning", undefined, undefined, undefined);
  assert.equal(estimateChatCost(1024, undefined, undefined, undefined, undefined), frontier);
});

test("REQ-119: cheap/fast/glm stay on the cheap heuristic, below the frontier reserve", () => {
  const frontier = estimateChatCost(1024, "reasoning", undefined, undefined, undefined);
  for (const mode of ["cheap", "fast", "glm"]) {
    assert.ok(estimateChatCost(1024, mode, undefined, undefined, undefined) < frontier);
  }
});

test("REQ-108: message is required (positional or --message)", () => {
  assert.equal(buildRequest({}).ok, false);
  assert.equal(buildRequest({ message: "hi" }).ok, true);
});

test("REQ-113: max_tokens defaults to 1024, temperature defaults to 1", () => {
  const r = buildRequest({ message: "hi" });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.value.maxTokens, 1024);
    assert.equal(r.value.temperature, 1);
  }
});

test("REQ-113: stop accepts at most 4 sequences", () => {
  assert.equal(buildRequest({ message: "hi", stop: ["a", "b", "c", "d", "e"] }).ok, false);
  assert.equal(buildRequest({ message: "hi", stop: ["a", "b", "c", "d"] }).ok, true);
});

test("REQ-114: thinking_budget_tokens must be within 1024-100000", () => {
  assert.equal(buildRequest({ message: "hi", model: "anthropic/claude-opus-4.8", thinkingBudgetTokens: 500 }).ok, false);
  assert.equal(buildRequest({ message: "hi", model: "anthropic/claude-opus-4.8", thinkingBudgetTokens: 1024 }).ok, true);
  assert.equal(buildRequest({ message: "hi", model: "anthropic/claude-opus-4.8", thinkingBudgetTokens: 100_001 }).ok, false);
});

test("REQ-118: routing:smart rejects combination with messages (multi-turn)", () => {
  const r = buildRequest({ message: "hi", routing: "smart", messages: [{ role: "user", content: "hey" }] });
  assert.equal(r.ok, false);
});

test("REQ-110/REQ-112: mode and routing_profile enums are validated, routing_profile defaults to auto", () => {
  assert.equal(buildRequest({ message: "hi", mode: "bogus-mode" }).ok, false);
  const r = buildRequest({ message: "hi" });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.value.routingProfile, "auto");
});
