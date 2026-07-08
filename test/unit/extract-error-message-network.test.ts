// Run with: npm test (tsx --test)
// REQ-DX-015 (closes spec-review it-1 SPEC-DX-1). extractErrorMessage() today (Red
// phase) reads only err.message/err.response and silently discards err.cause/err.name
// — these tests assert the NEW marker-appending behavior the spec requires, and FAIL
// against today's src/core/errors.ts until Phase 2b implements it.
//
// Ground truth for the raw shapes below, directly verified live in this repo before
// writing behavioral-spec.md's REQ-DX-011/015 (node -e against real unreachable
// hosts/ports): Node's fetch() throws `TypeError: fetch failed` with `.cause.code`
// matching ECONNREFUSED/ENOTFOUND/ETIMEDOUT/EAI_AGAIN; AbortSignal.timeout() produces
// an error NAMED "TimeoutError" (NOT "AbortError").
import { test } from "node:test";
import assert from "node:assert/strict";
import { extractErrorMessage } from "../../src/core/errors.js";

function fetchFailedWithCause(code: string): Error {
  const cause = Object.assign(new Error(code === "ENOTFOUND" ? `getaddrinfo ${code}` : code), { code });
  return Object.assign(new TypeError("fetch failed"), { cause });
}

test("REQ-DX-015: extractErrorMessage appends a network marker for ENOTFOUND (real DNS-failure shape)", () => {
  const out = extractErrorMessage(fetchFailedWithCause("ENOTFOUND"));
  assert.match(out, /ENOTFOUND/, "the ENOTFOUND cause code must be discoverable in the returned string");
});

test("REQ-DX-015: extractErrorMessage appends a network marker for ECONNREFUSED", () => {
  const out = extractErrorMessage(fetchFailedWithCause("ECONNREFUSED"));
  assert.match(out, /ECONNREFUSED/);
});

test("REQ-DX-015: extractErrorMessage appends a network marker for ETIMEDOUT", () => {
  const out = extractErrorMessage(fetchFailedWithCause("ETIMEDOUT"));
  assert.match(out, /ETIMEDOUT/);
});

test("REQ-DX-015: extractErrorMessage appends a network marker for EAI_AGAIN", () => {
  const out = extractErrorMessage(fetchFailedWithCause("EAI_AGAIN"));
  assert.match(out, /EAI_AGAIN/);
});

test("REQ-DX-015: extractErrorMessage detects a TimeoutError-named error (isTimeoutError reuse) and appends a network/timeout marker", () => {
  const err = Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" });
  const out = extractErrorMessage(err);
  assert.match(out, /network|timeout/i, "a timeout failure must surface a detectable network/timeout marker");
});

test("REQ-DX-015: extractErrorMessage detects an AbortError-named error too (isTimeoutError already handles both names)", () => {
  const err = Object.assign(new Error("The operation was aborted"), { name: "AbortError" });
  const out = extractErrorMessage(err);
  assert.match(out, /network|timeout/i);
});

test("REQ-DX-015: extractErrorMessage is UNCHANGED for every non-network-failure case (REQ-DX-NG-003's additive-only guarantee) — combined with a network-marker case so this test still fails in Red phase", () => {
  assert.equal(extractErrorMessage({ message: "plain failure" }), "plain failure");
  assert.equal(extractErrorMessage("not an object"), "not an object");
  // The non-network cases above already pass today (regression guard, no new code
  // needed) — this assertion is what makes the WHOLE test genuinely Red-phase-failing,
  // per this repo's schema-parity.test.ts convention of not shipping a standalone
  // test that would trivially pass before any implementation exists.
  assert.match(extractErrorMessage(fetchFailedWithCause("ENOTFOUND")), /ENOTFOUND/);
});
