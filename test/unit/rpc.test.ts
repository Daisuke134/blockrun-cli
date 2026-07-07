// Run with: npm test (tsx --test)
// PROP-140 (REQ-166–169, REQ-200, REQ-201). estimateRpcCost is a direct port of
// rpc.ts's inline RPC_PRICE_USD * batchCount math; no dedicated cost/rpc.ts module is
// listed in verification-architecture.md §1.1, so it lives in src/args/rpc.ts.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRequest, estimateRpcCost } from "../../src/args/rpc.js";

test("REQ-169: estimateRpcCost is $0.002 for a single (non-array) body", () => {
  assert.equal(estimateRpcCost({ jsonrpc: "2.0", id: 1, method: "eth_blockNumber" }), 0.002);
});

test("REQ-169: estimateRpcCost charges per batch element", () => {
  assert.equal(estimateRpcCost([{ jsonrpc: "2.0", id: 1, method: "a" }, { jsonrpc: "2.0", id: 2, method: "b" }]), 0.004);
});

test("REQ-167: exactly one of method or body must be provided", () => {
  assert.equal(buildRequest({ network: "base" }).ok, false, "neither given");
  assert.equal(buildRequest({ network: "base", method: "eth_blockNumber" }).ok, true);
  assert.equal(buildRequest({ network: "base", body: { jsonrpc: "2.0", id: 1, method: "eth_blockNumber" } }).ok, true);
});

test("REQ-168/REQ-201: network must be a well-formed chain slug before any network call", () => {
  assert.equal(buildRequest({ network: "../v1/modal/sandbox/create", method: "x" }).ok, false);
  assert.equal(buildRequest({ network: "eth.mainnet", method: "x" }).ok, false);
  assert.equal(buildRequest({ network: "arbitrum-one", method: "eth_blockNumber" }).ok, true);
});

test("REQ-166: params defaults to an empty array when method is used without params", () => {
  const r = buildRequest({ network: "base", method: "eth_blockNumber" });
  assert.equal(r.ok, true);
  if (r.ok) assert.deepEqual(r.value.body, { jsonrpc: "2.0", id: 1, method: "eth_blockNumber", params: [] });
});
