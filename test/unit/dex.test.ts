// Run with: npm test (tsx --test)
// PROP-137 (REQ-163–165). chain-filter + top-10-by-volume sort is pure logic
// (rankPairs), independent of the DexScreener fetch itself (which is Tier 2).
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRequest, rankPairs } from "../../src/args/dex.js";

type Pair = { chainId: string; volume: { h24: number } };

function pair(chainId: string, vol: number): Pair {
  return { chainId, volume: { h24: vol } };
}

test("REQ-163: at least one of query/token/symbol is required", () => {
  assert.equal(buildRequest({}).ok, false);
  assert.equal(buildRequest({ query: "SOL" }).ok, true);
  assert.equal(buildRequest({ token: "0xabc" }).ok, true);
  assert.equal(buildRequest({ symbol: "PEPE" }).ok, true);
});

test("REQ-165: rankPairs sorts by 24h volume descending", () => {
  const pairs = [pair("base", 10), pair("base", 100), pair("base", 50)];
  const out = rankPairs(pairs, undefined);
  assert.deepEqual(out.map((p) => p.volume.h24), [100, 50, 10]);
});

test("REQ-165: rankPairs caps at the top 10", () => {
  const pairs = Array.from({ length: 15 }, (_, i) => pair("base", i));
  assert.equal(rankPairs(pairs, undefined).length, 10);
});

test("REQ-165: rankPairs filters by a case-insensitive substring match on chainId", () => {
  const pairs = [pair("ethereum", 10), pair("Base", 20), pair("solana", 30)];
  const out = rankPairs(pairs, "base");
  assert.deepEqual(out.map((p) => p.chainId), ["Base"]);
});
