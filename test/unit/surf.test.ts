// Run with: npm test (tsx --test)
// PROP-152 (REQ-178–181, REQ-200). estimateSurfCost is a verbatim port of surf.ts's
// estimateSurfCost (verification-architecture.md §1.1 cost/surf.ts) — literally reuses
// blockrun-mcp's own surf.test.ts assertions per verification-architecture.md §2.2.
import { test } from "node:test";
import assert from "node:assert/strict";
import { estimateSurfCost } from "../../src/core/cost/surf.js";
import { buildRequest } from "../../src/args/surf.js";

test("REQ-179: estimateSurfCost prices the exact tier tables", () => {
  assert.equal(estimateSurfCost("onchain/sql"), 0.02);
  assert.equal(estimateSurfCost("chat/completions"), 0.02);
  assert.equal(estimateSurfCost("social/mindshare"), 0.005);
  assert.equal(estimateSurfCost("wallet/detail"), 0.005);
  assert.equal(estimateSurfCost("search/web"), 0.005);
  assert.equal(estimateSurfCost("market/price"), 0.001);
});

test("REQ-180: estimateSurfCost is not downgraded by a query string or trailing slash", () => {
  assert.equal(estimateSurfCost("onchain/schema?chain=ethereum"), 0.02);
  assert.equal(estimateSurfCost("chat/completions/"), 0.02);
  assert.equal(estimateSurfCost("social/mindshare?q=eth&interval=1d"), 0.005);
  assert.equal(estimateSurfCost("token/holders?token=0x1"), 0.005);
});

test("REQ-178: path is required", () => {
  assert.equal(buildRequest({}).ok, false);
  assert.equal(buildRequest({ path: "market/price", params: { symbol: "BTC" } }).ok, true);
});

test("REQ-181: a body presence routes as POST; its absence routes as GET with params", () => {
  const withBody = buildRequest({ path: "onchain/sql", body: { sql: "SELECT 1" } });
  assert.equal(withBody.ok, true);
  if (withBody.ok) assert.equal(withBody.value.method, "POST");

  const withoutBody = buildRequest({ path: "market/price", params: { symbol: "BTC" } });
  assert.equal(withoutBody.ok, true);
  if (withoutBody.ok) assert.equal(withoutBody.value.method, "GET");
});

test("REQ-200: path traversal is rejected before cost estimation", () => {
  assert.equal(buildRequest({ path: "../v1/modal/sandbox/create" }).ok, false);
});
