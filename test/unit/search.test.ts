// Run with: npm test (tsx --test)
// PROP-125 (REQ-152–153). estimateSearchCost is a verbatim port of search.ts's
// estimateSearchCost (verification-architecture.md §1.1 cost/search.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { estimateSearchCost } from "../../src/core/cost/search.js";
import { buildRequest } from "../../src/args/search.js";

test("REQ-153: estimateSearchCost defaults to max_results=10 -> $0.25 with no body", () => {
  assert.equal(estimateSearchCost(undefined), 0.25);
  assert.equal(estimateSearchCost({}), 0.25);
});

test("REQ-153: estimateSearchCost = $0.025 * max_results", () => {
  assert.equal(estimateSearchCost({ max_results: 1 }), 0.025);
  assert.equal(estimateSearchCost({ max_results: 50 }), 1.25);
});

test("REQ-153: estimateSearchCost clamps max_results to [1,50] and floors non-integers", () => {
  assert.equal(estimateSearchCost({ max_results: 500 }), 1.25, "clamped to 50");
  assert.equal(estimateSearchCost({ max_results: 3.7 }), 0.075, "floored to 3");
  assert.equal(estimateSearchCost({ max_results: -5 }), 0.25, "non-positive falls back to default 10");
  assert.equal(estimateSearchCost({ max_results: "abc" as unknown as number }), 0.25, "non-number falls back to default 10");
});

test("REQ-152: query is required", () => {
  assert.equal(buildRequest({}).ok, false);
  assert.equal(buildRequest({ query: "ethereum pectra" }).ok, true);
});

test("REQ-152: sources accepts any subset of web/x/news", () => {
  assert.equal(buildRequest({ query: "q", sources: ["x"] }).ok, true);
  assert.equal(buildRequest({ query: "q", sources: ["web", "news"] }).ok, true);
  assert.equal(buildRequest({ query: "q", sources: ["telegram"] }).ok, false);
});

test("REQ-152: max_results is bounded 1-50", () => {
  assert.equal(buildRequest({ query: "q", maxResults: 0 }).ok, false);
  assert.equal(buildRequest({ query: "q", maxResults: 51 }).ok, false);
  assert.equal(buildRequest({ query: "q", maxResults: 1 }).ok, true);
});

test("REQ-152: from_date/to_date must be YYYY-MM-DD", () => {
  assert.equal(buildRequest({ query: "q", fromDate: "2026/01/01" }).ok, false);
  assert.equal(buildRequest({ query: "q", fromDate: "2026-01-01" }).ok, true);
});
