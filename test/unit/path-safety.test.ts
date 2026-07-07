// Run with: npm test (tsx --test)
// PROP-200, PROP-201 (REQ-200, REQ-201). Verbatim port of blockrun-mcp's own
// path-safety.test.ts — same traversal shapes, same expected outcomes — because
// src/core/path-safety.ts is a byte-for-byte port of the clone's
// src/utils/path-safety.ts (verification-architecture.md §1.1).
import { test } from "node:test";
import assert from "node:assert/strict";
import { hasPathTraversal, isValidNetworkSlug, normalizeClassifyPath } from "../../src/core/path-safety.js";

test("REQ-200/PROP-200: hasPathTraversal flags parent/current-dir segments that escape a namespace", () => {
  assert.equal(hasPathTraversal("../chat/completions"), true);
  assert.equal(hasPathTraversal("../../v1/phone/numbers/buy"), true);
  assert.equal(hasPathTraversal("foo/../bar"), true);
  assert.equal(hasPathTraversal("foo/./bar"), true);
  assert.equal(hasPathTraversal(".."), true);
  assert.equal(hasPathTraversal("."), true);
});

test("REQ-200/PROP-200: hasPathTraversal catches percent-encoded and backslash traversal", () => {
  assert.equal(hasPathTraversal("%2e%2e/pm/markets"), true);
  assert.equal(hasPathTraversal("%2E%2E/v1/phone/numbers/buy"), true);
  assert.equal(hasPathTraversal(".%2e/foo"), true);
  assert.equal(hasPathTraversal("%2e/foo"), true);
  assert.equal(hasPathTraversal("..\\..\\v1\\voice\\call"), true);
});

test("REQ-200/PROP-200: hasPathTraversal tolerates a malformed percent and legit encoded chars", () => {
  assert.equal(hasPathTraversal("foo%zzbar"), false);
  assert.equal(hasPathTraversal("search/web%20query"), false);
});

test("REQ-200/PROP-200: hasPathTraversal allows legitimate passthrough paths", () => {
  assert.equal(hasPathTraversal(""), false);
  assert.equal(hasPathTraversal("market/price"), false);
  assert.equal(hasPathTraversal("polymarket/events"), false);
  assert.equal(hasPathTraversal("prices/coingecko:ethereum"), false);
  assert.equal(hasPathTraversal("prices/base:0x833589.eth"), false);
  assert.equal(hasPathTraversal("kalshi/markets/KXBTC-25MAR14"), false);
});

test("PROP-180: normalizeClassifyPath strips query/fragment, leading+trailing slashes, and lowercases", () => {
  assert.equal(normalizeClassifyPath("phone/numbers/buy?x=1"), "phone/numbers/buy");
  assert.equal(normalizeClassifyPath("phone/numbers/buy/"), "phone/numbers/buy");
  assert.equal(normalizeClassifyPath("/onchain/sql"), "onchain/sql");
  assert.equal(normalizeClassifyPath("Phone/Numbers/Buy"), "phone/numbers/buy");
  assert.equal(normalizeClassifyPath("social/mindshare?q=eth&interval=1d"), "social/mindshare");
  assert.equal(normalizeClassifyPath("onchain/sql#frag"), "onchain/sql");
  assert.equal(normalizeClassifyPath("market/price"), "market/price");
});

test("REQ-201/PROP-201: isValidNetworkSlug accepts simple chain identifiers only", () => {
  assert.equal(isValidNetworkSlug("ethereum"), true);
  assert.equal(isValidNetworkSlug("base"), true);
  assert.equal(isValidNetworkSlug("arbitrum-one"), true);
  assert.equal(isValidNetworkSlug("bsc"), true);
});

test("REQ-201/PROP-201: isValidNetworkSlug rejects traversal / path separators / empties", () => {
  assert.equal(isValidNetworkSlug("../chat/completions"), false);
  assert.equal(isValidNetworkSlug("base/extra"), false);
  assert.equal(isValidNetworkSlug(".."), false);
  assert.equal(isValidNetworkSlug(""), false);
  assert.equal(isValidNetworkSlug("eth.mainnet"), false);
});
