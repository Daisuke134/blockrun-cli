// Run with: npm test (tsx --test)
// PROP-206 (REQ-154, REQ-154a). exa's canonical surface is --path <...> --body <json>
// [--agent-id]; per-path convenience flags are documented aliases that compile into
// body.*. Both forms must produce an IDENTICAL request body; alias + --body conflict
// on the same field is rejected.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRequest } from "../../src/args/exa.js";

test("REQ-154a: search path — --query/--num-results/--category/--include-domains/--exclude-domains compile into body.*", () => {
  const viaAlias = buildRequest({
    path: "search", query: "ethereum", numResults: 5, category: "news",
    includeDomains: ["a.com", "b.com"], excludeDomains: ["c.com"],
  });
  const viaCanonical = buildRequest({
    path: "search",
    body: { query: "ethereum", numResults: 5, category: "news", includeDomains: ["a.com", "b.com"], excludeDomains: ["c.com"] },
  });
  assert.equal(viaAlias.ok, true);
  assert.equal(viaCanonical.ok, true);
  if (viaAlias.ok && viaCanonical.ok) assert.deepEqual(viaAlias.value.body, viaCanonical.value.body);
});

test("REQ-154a: answer path — --query compiles into body.query", () => {
  const r = buildRequest({ path: "answer", query: "what is x402?" });
  assert.equal(r.ok, true);
  if (r.ok) assert.deepEqual(r.value.body, { query: "what is x402?" });
});

test("REQ-154a: contents path — --urls (array or csv) compiles into body.urls", () => {
  const viaArray = buildRequest({ path: "contents", urls: ["https://a", "https://b"] });
  const viaCsv = buildRequest({ path: "contents", urls: "https://a,https://b" });
  assert.equal(viaArray.ok, true);
  assert.equal(viaCsv.ok, true);
  if (viaArray.ok && viaCsv.ok) assert.deepEqual(viaArray.value.body, viaCsv.value.body);
});

test("REQ-154a: find-similar path — --url/--num-results compile into body.url/body.numResults", () => {
  const r = buildRequest({ path: "find-similar", url: "https://blockrun.ai", numResults: 3 });
  assert.equal(r.ok, true);
  if (r.ok) assert.deepEqual(r.value.body, { url: "https://blockrun.ai", numResults: 3 });
});

test("REQ-154a: an alias conflicting with --body setting the SAME field is rejected", () => {
  const r = buildRequest({ path: "answer", query: "x", body: { query: "y" } });
  assert.equal(r.ok, false);
});
