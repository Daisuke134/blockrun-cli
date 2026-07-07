// Run with: npm test (tsx --test)
// PROP-006, PROP-202 (REQ-010, REQ-011, REQ-210, REQ-211). Port of blockrun-mcp's
// errors.test.ts. One deliberate deviation from the clone, per
// verification-architecture.md §1.1: formatError's payment-error branch cannot read
// a cached getChain() (the CLI's pure core has no impure wallet-state import), so the
// chain is passed explicitly via opts.chain (default "base" when omitted, matching the
// clone's own getChain() default).
import { test } from "node:test";
import assert from "node:assert/strict";
import { extractErrorMessage, formatError, isPaymentRejectionError } from "../../src/core/errors.js";

test("REQ-211: model-unavailable (token360) steers to a sibling model, not a generic blip", () => {
  const msg = "Video generation failed: API error 500: token360 video submit failed: Model 'seedance-2.0-fast' not found or not active for requested provider";
  const out = formatError(msg, { altModels: "bytedance/seedance-2.0" });
  assert.match(out, /temporarily unavailable upstream/);
  assert.match(out, /bytedance\/seedance-2\.0/);
  assert.doesNotMatch(out, /temporary API issue/);
});

test("REQ-211: model-unavailable without altModels gives neutral guidance, no model named", () => {
  const out = formatError("token360 video submit failed: Model 'x' not active for requested provider");
  assert.match(out, /temporarily unavailable upstream/);
  assert.doesNotMatch(out, /e\.g\./);
});

test("REQ-210: generic 500 gives 'temporary API issue' guidance", () => {
  const out = formatError("Image generation failed: API error 500: Internal server error");
  assert.match(out, /temporary API issue/);
  assert.doesNotMatch(out, /gpt-4o/);
});

test("REQ-210: generic 500 with altModels names same-domain alternatives", () => {
  const out = formatError("Image generation failed: API error 500: boom", { altModels: "google/nano-banana, zai/cogview-4" });
  assert.match(out, /temporary API issue/);
  assert.match(out, /google\/nano-banana/);
});

test("REQ-210: payment/402 gives funding guidance on Base by default (no chain passed)", () => {
  const out = formatError("API error 402: insufficient balance");
  assert.match(out, /needs funding/);
  assert.match(out, /Base network/);
  assert.doesNotMatch(out, /temporary API issue/);
});

test("REQ-210: payment/402 names Solana when chain:'solana' is passed explicitly", () => {
  const out = formatError("API error 402: insufficient balance", { chain: "solana" });
  assert.match(out, /Solana network/);
});

test("plain validation message gets no canned guidance appended", () => {
  const out = formatError("mask cannot be combined with multiple source images");
  assert.equal(out, "Error: mask cannot be combined with multiple source images");
});

test("a dollar amount like $1.4020 is not misread as a 402", () => {
  const out = formatError("charged $1.4020 for the call");
  assert.equal(out, "Error: charged $1.4020 for the call");
});

test("the integer part of a decimal amount is not misread as a status code", () => {
  assert.equal(formatError("settled $402.50 for the call"), "Error: settled $402.50 for the call");
  assert.equal(formatError("refunded $500.00 to the wallet"), "Error: refunded $500.00 to the wallet");
  assert.equal(formatError("cost 402.99 usdc"), "Error: cost 402.99 usdc");
});

test("genuine status codes still classify after the regex tightening", () => {
  assert.match(formatError("got 402"), /needs funding/);
  assert.match(formatError("error 500 occurred"), /temporary API issue/);
  assert.match(formatError("API error 402: declined"), /needs funding/);
});

test("a non-402 probe failure is not misclassified as a funding error", () => {
  for (const status of [425, 503, 400, 404]) {
    const out = formatError(`Music generation failed: Unexpected status ${status} (the endpoint did not return a quote): upstream issue`);
    assert.doesNotMatch(out, /needs funding/, `status ${status} must not say needs funding`);
  }
});

test("REQ-210: isPaymentRejectionError matches settlement failures, not outage status text", () => {
  assert.equal(isPaymentRejectionError("Payment rejected. Check your wallet balance."), true);
  assert.equal(isPaymentRejectionError("insufficient balance"), true);
  assert.equal(isPaymentRejectionError('Unexpected response 500 (expected a 402 payment challenge): {"error":"bad gateway"}'), false);
  assert.equal(isPaymentRejectionError("Unexpected response 425 (expected a 402 payment challenge): liveness not finished"), false);
});

test("REQ-211: extractErrorMessage surfaces message/hint/missing_params from a structured response body", () => {
  const err = { message: "API error 422", response: { message: "invalid model", hint: "use openai/gpt-5.5", missing_params: ["model"] } };
  const out = extractErrorMessage(err);
  assert.match(out, /invalid model/);
  assert.match(out, /Hint: use openai\/gpt-5\.5/);
  assert.match(out, /Missing: model/);
});

test("extractErrorMessage falls back to the bare message when there is no response body", () => {
  assert.equal(extractErrorMessage({ message: "plain failure" }), "plain failure");
  assert.equal(extractErrorMessage("not an object"), "not an object");
});
