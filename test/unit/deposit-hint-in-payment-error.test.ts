// Run with: npm test (tsx --test)
// PROP-FUND-008 (REQ-FUND-011, -012, -013). formatError()'s payment-error branch does
// not yet carry the new card-funding hint (Red phase) — fails until Phase 2b adds it.
// Deliberately a NEW file, NOT an edit to test/unit/errors.test.ts — REQ-FUND-012's
// "regression, not just trust" claim requires that file to be left completely
// UNCHANGED and still pass unmodified (verified via `npm test` + `git diff
// test/unit/errors.test.ts` being empty for this feature).
import { test } from "node:test";
import assert from "node:assert/strict";
import { formatError } from "../../src/core/errors.js";

test("PROP-FUND-008/REQ-FUND-011: a Base payment-error message gains a card-funding hint pointing to `wallet --action deposit`", () => {
  const out = formatError("API error 402: insufficient balance");
  assert.match(out, /blockrun wallet --action deposit/);
});

test("PROP-FUND-008/REQ-FUND-011: the hint is present even when chain is explicitly 'base'", () => {
  const out = formatError("API error 402: insufficient balance", { chain: "base" });
  assert.match(out, /blockrun wallet --action deposit/);
});

test("PROP-FUND-008/REQ-FUND-013: a Solana payment-error message does NOT gain the card-funding hint (Coinbase Onramp is Base-only)", () => {
  const out = formatError("API error 402: insufficient balance", { chain: "solana" });
  assert.doesNotMatch(out, /blockrun wallet --action deposit/);
  // REQ-FUND-013: the EXISTING Solana guidance text must still be present, unchanged.
  assert.match(out, /Solana network/);
});

test("PROP-FUND-008/REQ-FUND-011: the new hint does not appear for a NON-payment-error message (model-unavailable/server-error/plain validation)", () => {
  assert.doesNotMatch(formatError("Model 'x' not found or not active for requested provider"), /blockrun wallet --action deposit/);
  assert.doesNotMatch(formatError("API error 500: internal server error"), /blockrun wallet --action deposit/);
  assert.doesNotMatch(formatError("mask cannot be combined with multiple source images"), /blockrun wallet --action deposit/);
});
