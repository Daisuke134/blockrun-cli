// Run with: npm test (tsx --test)
// PROP-128 (REQ-154–155). estimateExaCost is a verbatim port of exa.ts's
// estimateExaCost (verification-architecture.md §1.1 cost/exa.ts). REQ-154 restricts
// --path to the 4 typed sub-flag shapes documented in the tool description (search,
// answer, contents, find-similar) rather than an arbitrary passthrough string.
import { test } from "node:test";
import assert from "node:assert/strict";
import { estimateExaCost } from "../../src/core/cost/exa.js";
import { buildRequest } from "../../src/args/exa.js";

test("REQ-155: estimateExaCost('contents') = $0.002 * url count", () => {
  assert.equal(estimateExaCost("contents", { urls: ["https://a", "https://b"] }), 0.004);
  assert.equal(estimateExaCost("contents", { urls: ["https://a"] }), 0.002);
});

test("REQ-155: estimateExaCost('contents') with no/empty urls falls back to 1 URL", () => {
  assert.equal(estimateExaCost("contents", {}), 0.002);
  assert.equal(estimateExaCost("contents", { urls: [] }), 0.002);
});

test("REQ-155: estimateExaCost is $0.01 flat for search/answer/find-similar", () => {
  assert.equal(estimateExaCost("search", { query: "x" }), 0.01);
  assert.equal(estimateExaCost("answer", { query: "x" }), 0.01);
  assert.equal(estimateExaCost("find-similar", { url: "https://a" }), 0.01);
});

test("REQ-154: path must be one of search/answer/contents/find-similar", () => {
  assert.equal(buildRequest({ path: "delete-everything", body: {} }).ok, false);
  assert.equal(buildRequest({ path: "search", body: { query: "x" } }).ok, true);
});

test("REQ-154: body is required", () => {
  assert.equal(buildRequest({ path: "answer" }).ok, false);
});
