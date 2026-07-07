// Run with: npm test (tsx --test)
// PROP-206 (REQ-152, REQ-152a). search's canonical surface is --body <json> [--path]
// [--agent-id]; --query/--sources/--max-results/--from-date/--to-date are documented
// ergonomic aliases that compile into body.*. Both forms must produce an IDENTICAL
// request body; alias + --body setting the SAME field is a conflict error.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRequest } from "../../src/args/search.js";

test("REQ-152: the canonical --body form works standalone", () => {
  const r = buildRequest({ body: { query: "ethereum pectra", max_results: 5 } });
  assert.equal(r.ok, true);
  if (r.ok) assert.deepEqual(r.value.body, { query: "ethereum pectra", max_results: 5 });
});

test("REQ-152a: --query alias compiles into body.query, identical to the canonical --body form", () => {
  const viaAlias = buildRequest({ query: "ethereum pectra" });
  const viaCanonical = buildRequest({ body: { query: "ethereum pectra" } });
  assert.equal(viaAlias.ok, true);
  assert.equal(viaCanonical.ok, true);
  if (viaAlias.ok && viaCanonical.ok) assert.deepEqual(viaAlias.value.body, viaCanonical.value.body);
});

test("REQ-152a: --sources/--max-results/--from-date/--to-date all compile into body.*", () => {
  const r = buildRequest({
    query: "eth", sources: ["web", "x"], maxResults: 5,
    fromDate: "2026-01-01", toDate: "2026-02-01",
  });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.deepEqual(r.value.body, {
      query: "eth", sources: ["web", "x"], max_results: 5,
      from_date: "2026-01-01", to_date: "2026-02-01",
    });
  }
});

test("REQ-152a: --sources also accepts a comma-separated string, normalized to the same array", () => {
  const viaCsv = buildRequest({ query: "eth", sources: "web,x" });
  const viaArray = buildRequest({ query: "eth", sources: ["web", "x"] });
  assert.equal(viaCsv.ok, true);
  assert.equal(viaArray.ok, true);
  if (viaCsv.ok && viaArray.ok) assert.deepEqual(viaCsv.value.body, viaArray.value.body);
});

test("REQ-152a: an alias conflicting with --body setting the SAME field is rejected", () => {
  const r = buildRequest({ query: "eth", body: { query: "different" } });
  assert.equal(r.ok, false);
});

test("REQ-152a: an alias plus --body setting a DIFFERENT field merges without conflict", () => {
  const r = buildRequest({ query: "eth", body: { max_results: 3 } });
  assert.equal(r.ok, true);
  if (r.ok) assert.deepEqual(r.value.body, { query: "eth", max_results: 3 });
});
