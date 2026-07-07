// Run with: npm test (tsx --test)
// PROP-134 (REQ-159–162). No dedicated cost/price.ts port (the paid/free decision is a
// one-line boolean, not a ported pure function per verification-architecture.md §1.1's
// module table), so isPaidPriceCall lives in src/args/price.ts, documented alongside
// buildRequest.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRequest, isPaidPriceCall } from "../../src/args/price.js";

test("REQ-161: crypto/fx/commodity are free for price/history/list", () => {
  for (const category of ["crypto", "fx", "commodity"]) {
    for (const action of ["price", "history", "list"] as const) {
      assert.equal(isPaidPriceCall(action, category), false, `${category}/${action} should be free`);
    }
  }
});

test("REQ-161: stocks/usstock price+history cost $0.001; list is always free", () => {
  assert.equal(isPaidPriceCall("price", "stocks"), true);
  assert.equal(isPaidPriceCall("history", "usstock"), true);
  assert.equal(isPaidPriceCall("list", "stocks"), false);
});

test("REQ-160: category=stocks requires market", () => {
  assert.equal(buildRequest({ action: "price", category: "stocks", symbol: "AAPL" }).ok, false);
  assert.equal(buildRequest({ action: "price", category: "stocks", symbol: "AAPL", market: "us" }).ok, true);
});

test("REQ-162: price action requires symbol", () => {
  assert.equal(buildRequest({ action: "price", category: "crypto" }).ok, false);
  assert.equal(buildRequest({ action: "price", category: "crypto", symbol: "BTC-USD" }).ok, true);
});

test("REQ-162: history action requires symbol and from", () => {
  assert.equal(buildRequest({ action: "history", category: "crypto", symbol: "BTC-USD" }).ok, false, "missing from");
  assert.equal(buildRequest({ action: "history", category: "crypto", symbol: "BTC-USD", from: 1700000000 }).ok, true);
});

test("REQ-159: list requires only category", () => {
  assert.equal(buildRequest({ action: "list", category: "crypto" }).ok, true);
});
