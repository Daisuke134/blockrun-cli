// Run with: npm test (tsx --test)
// PROP-149 (REQ-175–177, REQ-200). estimatePhoneCost is a verbatim port of phone.ts's
// estimatePhoneCost (verification-architecture.md §1.1 cost/phone.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { estimatePhoneCost } from "../../src/core/cost/phone.js";
import { buildRequest } from "../../src/args/phone.js";

test("REQ-176: estimatePhoneCost prices the exact known tiers", () => {
  assert.equal(estimatePhoneCost("phone/numbers/buy", true), 5);
  assert.equal(estimatePhoneCost("phone/numbers/renew", true), 5);
  assert.equal(estimatePhoneCost("voice/call", true), 0.54);
  assert.equal(estimatePhoneCost("phone/lookup", true), 0.01);
  assert.equal(estimatePhoneCost("phone/lookup/fraud", true), 0.05);
  assert.equal(estimatePhoneCost("phone/numbers/release", true), 0);
  assert.equal(estimatePhoneCost("phone/numbers/list", true), 0.001);
});

test("REQ-176: the free voice/call/{id} status poll (GET, no body) stays free", () => {
  assert.equal(estimatePhoneCost("voice/call/CA123abc", false), 0);
});

test("REQ-176: not downgraded by a query string, trailing slash, or casing", () => {
  assert.equal(estimatePhoneCost("phone/numbers/buy?areaCode=415", true), 5);
  assert.equal(estimatePhoneCost("phone/numbers/buy/", true), 5);
  assert.equal(estimatePhoneCost("Phone/Numbers/Buy", true), 5);
  assert.equal(estimatePhoneCost("voice/call?trace=1", true), 0.54);
});

test("REQ-177: voice/call requires a 'from' field in the body", () => {
  assert.equal(buildRequest({ path: "voice/call", body: { to: "+15551234567", task: "hi" } }).ok, false);
  assert.equal(
    buildRequest({ path: "voice/call", body: { to: "+15551234567", from: "+15557654321", task: "hi" } }).ok,
    true,
  );
});

test("REQ-175: path is required", () => {
  assert.equal(buildRequest({}).ok, false);
  assert.equal(buildRequest({ path: "phone/numbers/list", body: {} }).ok, true);
});

test("REQ-200: path traversal is rejected before cost estimation", () => {
  assert.equal(buildRequest({ path: "../v1/modal/sandbox/create" }).ok, false);
});
