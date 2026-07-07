// Run with: npm test (tsx --test)
// PROP-146 (REQ-172–174, REQ-200). estimateModalCost and modalTimeoutMs are verbatim
// ports of modal.ts (verification-architecture.md §1.1 cost/modal.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { estimateModalCost, modalTimeoutMs } from "../../src/core/cost/modal.js";
import { buildRequest } from "../../src/args/modal.js";

const FLOOR_MS = 300 * 1000 + 15_000;
const SLACK = 15_000;

test("REQ-173: estimateModalCost is $0.01 for sandbox/create, else $0.001", () => {
  assert.equal(estimateModalCost("sandbox/create"), 0.01);
  assert.equal(estimateModalCost("sandbox/exec"), 0.001);
  assert.equal(estimateModalCost("sandbox/status"), 0.001);
  assert.equal(estimateModalCost("sandbox/terminate"), 0.001);
});

test("REQ-174: modalTimeoutMs floors at the 300s sandbox default + 15s slack", () => {
  assert.equal(modalTimeoutMs(undefined), FLOOR_MS);
  assert.equal(modalTimeoutMs({}), FLOOR_MS);
  assert.equal(modalTimeoutMs({ timeout: 60 }), FLOOR_MS);
  assert.equal(modalTimeoutMs({ timeout: -5 }), FLOOR_MS);
});

test("REQ-174: modalTimeoutMs honors a longer requested timeout", () => {
  assert.equal(modalTimeoutMs({ timeout: 600 }), 600 * 1000 + SLACK);
});

test("REQ-174: modalTimeoutMs caps at 30 minutes", () => {
  assert.equal(modalTimeoutMs({ timeout: 99999 }), 1800 * 1000 + SLACK);
});

test("REQ-172: path must be one of the four sandbox lifecycle actions", () => {
  assert.equal(buildRequest({ path: "sandbox/delete-everything" }).ok, false);
  assert.equal(buildRequest({ path: "sandbox/create", body: {} }).ok, true);
});

test("REQ-200: path traversal is rejected before cost estimation", () => {
  assert.equal(buildRequest({ path: "../v1/rpc/base" }).ok, false);
});
