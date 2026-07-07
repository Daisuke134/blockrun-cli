// Run with: npm test (tsx --test)
// PROP-131 (REQ-156–158, REQ-200). estimateMarketCost is a verbatim port of
// markets.ts's estimateMarketCost (verification-architecture.md §1.1 cost/markets.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { estimateMarketCost } from "../../src/core/cost/markets.js";
import { buildRequest } from "../../src/args/markets.js";

test("REQ-157: any body-bearing (POST) call is $0.005 regardless of path", () => {
  assert.equal(estimateMarketCost("polymarket/events", {}), 0.005);
  assert.equal(estimateMarketCost("polymarket/wallet/identities", { addresses: [] }), 0.005);
});

test("REQ-157: a GET call on a Tier-2 substring path (wallet/smart/matching-markets/markets-search/binance) is $0.005", () => {
  assert.equal(estimateMarketCost("polymarket/wallet/0xabc", undefined), 0.005);
  assert.equal(estimateMarketCost("polymarket/markets/smart-activity", undefined), 0.005);
  assert.equal(estimateMarketCost("matching-markets", undefined), 0.005);
  assert.equal(estimateMarketCost("markets/search", undefined), 0.005);
  assert.equal(estimateMarketCost("binance/candles/BTCUSDT", undefined), 0.005);
});

test("REQ-157: a plain GET on a Tier-1 path is $0.001", () => {
  assert.equal(estimateMarketCost("polymarket/events", undefined), 0.001);
  assert.equal(estimateMarketCost("kalshi/markets", undefined), 0.001);
});

test("REQ-156: path is required", () => {
  assert.equal(buildRequest({}).ok, false);
  assert.equal(buildRequest({ path: "polymarket/events" }).ok, true);
});

test("REQ-200: path traversal is rejected before cost estimation", () => {
  assert.equal(buildRequest({ path: "../v1/modal/sandbox/create" }).ok, false);
});
