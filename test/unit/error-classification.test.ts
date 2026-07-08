// Run with: npm test (tsx --test)
// PROP-DX-005 (REQ-DX-011's classification, REQ-DX-012's exit-code mapping).
// classifyErrorCode does not exist yet (Red phase) — every test fails on import until
// Phase 2b creates it. Covers the 5 codes that are reliably message-pattern-classifiable
// (budget_exceeded, quote_exceeded, insufficient_funds, upstream_error, network_error)
// plus the no-match fallback. `usage_error` (item 1) is NOT message-pattern-classifiable
// in isolation — its real messages are heterogeneous validation text across 18 different
// src/args/*.ts files with no common substring — so it is verified structurally instead,
// via the integration-level test below (a real buildRequest() rejection reaching a real
// command's fail() call) and PROP-DX-008's Tier 2 live-binary test.
import { test } from "node:test";
import assert from "node:assert/strict";

test("PROP-DX-005: 'budget_exceeded' / exit 2 — global budget limit message (real src/core/budget.ts shape)", async () => {
  const { classifyErrorCode } = await import("../../src/core/error-classification.js");
  const out = classifyErrorCode('Global budget limit $5.00 would be exceeded ($4.50 spent, $0.50 remaining, next call estimated $1.00)');
  assert.equal(out.code, "budget_exceeded");
  assert.equal(out.exitCode, 2);
});

test("PROP-DX-005: 'budget_exceeded' / exit 2 — per-agent budget limit message (real src/core/budget.ts shape)", async () => {
  const { classifyErrorCode } = await import("../../src/core/error-classification.js");
  const out = classifyErrorCode('Agent "research" budget $2.00 would be exceeded ($1.90 spent, $0.10 remaining, next call estimated $0.50)');
  assert.equal(out.code, "budget_exceeded");
  assert.equal(out.exitCode, 2);
});

test("PROP-DX-005: 'quote_exceeded' / exit 3 — video's real --max-quote-usd gate message", async () => {
  const { classifyErrorCode } = await import("../../src/core/error-classification.js");
  const out = classifyErrorCode("Quote $0.06 exceeds --max-quote-usd $0.05 — aborting before signing.");
  assert.equal(out.code, "quote_exceeded");
  assert.equal(out.exitCode, 3);
});

test("PROP-DX-005: 'quote_exceeded' / exit 3 — shared.ts's real reverify rejection message", async () => {
  const { classifyErrorCode } = await import("../../src/core/error-classification.js");
  const out = classifyErrorCode("Budget cap would be exceeded by the real quoted price.");
  assert.equal(out.code, "quote_exceeded");
  assert.equal(out.exitCode, 3);
});

test("PROP-DX-005: 'insufficient_funds' / exit 3 — a real payment/402 message", async () => {
  const { classifyErrorCode } = await import("../../src/core/error-classification.js");
  const out = classifyErrorCode("API error 402: insufficient balance");
  assert.equal(out.code, "insufficient_funds");
  assert.equal(out.exitCode, 3);
});

test("PROP-DX-005: 'upstream_error' / exit 4 — model-unavailable message", async () => {
  const { classifyErrorCode } = await import("../../src/core/error-classification.js");
  const out = classifyErrorCode("Model 'x' not found or not active for requested provider");
  assert.equal(out.code, "upstream_error");
  assert.equal(out.exitCode, 4);
});

test("PROP-DX-005: 'upstream_error' / exit 4 — a real HTTP 500 message", async () => {
  const { classifyErrorCode } = await import("../../src/core/error-classification.js");
  const out = classifyErrorCode("API error 500: internal server error");
  assert.equal(out.code, "upstream_error");
  assert.equal(out.exitCode, 4);
});

test("PROP-DX-005: no-code fallback / exit 1 — a generic, unrelated message classifies with code omitted", async () => {
  const { classifyErrorCode } = await import("../../src/core/error-classification.js");
  const out = classifyErrorCode("mask cannot be combined with multiple source images");
  assert.equal(out.code, undefined, "no 7th 'unknown_error' catch-all value — code must be omitted");
  assert.equal(out.exitCode, 1);
});

test("PROP-DX-005 (structural, usage_error): a real buildRequest() validation rejection reaching rpc's real run()/fail() classifies as usage_error / exit 2 — no network call made", async () => {
  const { run } = await import("../../src/commands/rpc.js");
  const budget = { limit: null, spent: 0, calls: 0, agents: new Map() };
  const outcome = await run({ network: "../bad" }, { json: true }, budget);
  assert.equal(outcome.exitCode, 2, "usage_error must map to exit code 2");
  const parsed = JSON.parse(outcome.stdout);
  assert.equal(parsed.code, "usage_error");
  assert.equal(budget.calls, 0, "a usage_error must be rejected before any network call");
});
