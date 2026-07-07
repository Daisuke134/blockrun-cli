// Run with: npm test (tsx --test)
// PROP-143 (REQ-170–171, REQ-200). estimateDefiCost is a verbatim port of defi.ts's
// estimateDefiCost (verification-architecture.md §1.1 cost/defi.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { estimateDefiCost } from "../../src/core/cost/defi.js";
import { buildRequest } from "../../src/args/defi.js";

test("REQ-171: prices/* is $0.001", () => {
  assert.equal(estimateDefiCost("prices/coingecko:bitcoin"), 0.001);
  assert.equal(estimateDefiCost("prices/base:0x833589"), 0.001);
});

test("REQ-171: protocols/protocol/chains/yields are $0.005", () => {
  assert.equal(estimateDefiCost("protocols"), 0.005);
  assert.equal(estimateDefiCost("protocol/aave-v3"), 0.005);
  assert.equal(estimateDefiCost("chains"), 0.005);
  assert.equal(estimateDefiCost("yields"), 0.005);
});

test("REQ-170: path is required", () => {
  assert.equal(buildRequest({}).ok, false);
  assert.equal(buildRequest({ path: "chains" }).ok, true);
});

test("REQ-200: path traversal is rejected before cost estimation or any network call", () => {
  assert.equal(buildRequest({ path: "../v1/modal/sandbox/create" }).ok, false);
});
