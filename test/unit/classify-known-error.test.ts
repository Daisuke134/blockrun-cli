// Run with: npm test (tsx --test)
// PROP-DX-013 (REQ-DX-016, closes spec-review it-1 SPEC-DX-3). classifyKnownError does
// not exist yet (Red phase) — every test fails on import until Phase 2b extracts it
// from formatError()'s inline isModelUnavailable/isServerError/isPaymentError checks.
import { test } from "node:test";
import assert from "node:assert/strict";
import { formatError, isPaymentRejectionError } from "../../src/core/errors.js";

test("PROP-DX-013: classifyKnownError returns 'model_unavailable' for a not-active-for-provider message", async () => {
  const { classifyKnownError } = await import("../../src/core/errors.js");
  assert.equal(classifyKnownError("Model 'x' not found or not active for requested provider"), "model_unavailable");
});

test("PROP-DX-013: classifyKnownError returns 'server_error' for a 500", async () => {
  const { classifyKnownError } = await import("../../src/core/errors.js");
  assert.equal(classifyKnownError("API error 500: internal server error"), "server_error");
});

test("PROP-DX-013: classifyKnownError returns 'payment_error' for a 402/balance message", async () => {
  const { classifyKnownError } = await import("../../src/core/errors.js");
  assert.equal(classifyKnownError("API error 402: insufficient balance"), "payment_error");
});

test("PROP-DX-013: classifyKnownError returns null for a plain validation message", async () => {
  const { classifyKnownError } = await import("../../src/core/errors.js");
  assert.equal(classifyKnownError("mask cannot be combined with multiple source images"), null);
});

test("PROP-DX-013: priority-conflict case — a message matching BOTH model_unavailable and payment_error patterns classifies as model_unavailable, matching formatError()'s REAL branch order (isModelUnavailable checked before isPaymentError)", async () => {
  const { classifyKnownError } = await import("../../src/core/errors.js");
  const conflictMsg = "balance check failed: Model 'x' not found or not active for requested provider";
  assert.equal(classifyKnownError(conflictMsg), "model_unavailable");
  // Cross-check against formatError()'s OWN real output for the SAME message, so the
  // two can never disagree about which branch fired (the exact guarantee REQ-DX-016
  // requires) — not just that classifyKnownError "looks right" in isolation.
  const humanText = formatError(conflictMsg);
  assert.match(humanText, /temporarily unavailable upstream/);
  assert.doesNotMatch(humanText, /needs funding/);
});

test("PROP-DX-013: non-conflation — a bare 'payment' message (no 402/balance/insufficient/rejected) classifies via the NEW function but NOT via the narrower, pre-existing isPaymentRejectionError", async () => {
  const { classifyKnownError } = await import("../../src/core/errors.js");
  const bareMsg = "payment could not be processed at this time";
  assert.equal(classifyKnownError(bareMsg), "payment_error", "the new classifier reuses formatError()'s bare-'payment' check");
  assert.equal(isPaymentRejectionError(bareMsg), false, "isPaymentRejectionError has no bare-'payment' check — proving the two are genuinely different functions");
});
