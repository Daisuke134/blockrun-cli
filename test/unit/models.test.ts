// Run with: npm test (tsx --test)
// PROP-107 (REQ-120–122). src/args/models.ts: buildRequest(flags) validates
// category/provider; filterModels() is the pure category/provider filter logic used by
// the command layer after the (mocked/real) catalog fetch.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRequest, filterModels } from "../../src/args/models.js";

test("REQ-120: category defaults to 'all'", () => {
  const r = buildRequest({});
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.value.category, "all");
});

test("REQ-120: rejects an unknown category", () => {
  assert.equal(buildRequest({ category: "embeddings-and-stuff" }).ok, false);
});

type M = { id: string; categories?: string[]; type?: string; pricePerImage?: number };

const catalog: M[] = [
  { id: "openai/gpt-5.5", categories: ["chat"] },
  { id: "anthropic/claude-opus-4.8", categories: ["chat", "reasoning"] },
  { id: "openai/gpt-image-2", type: "image", pricePerImage: 0.06 },
  { id: "openai/text-embedding-3", categories: ["embedding"] },
];

test("REQ-120/PROP-107: filterModels('image') returns only image-typed models", () => {
  const out = filterModels(catalog, "image", undefined);
  assert.deepEqual(out.map((m) => m.id), ["openai/gpt-image-2"]);
});

test("REQ-120/PROP-107: filterModels('embedding') matches by id containing 'embed'", () => {
  const out = filterModels(catalog, "embedding", undefined);
  assert.deepEqual(out.map((m) => m.id), ["openai/text-embedding-3"]);
});

test("REQ-120/PROP-107: filterModels('reasoning') matches by categories array", () => {
  const out = filterModels(catalog, "reasoning", undefined);
  assert.deepEqual(out.map((m) => m.id), ["anthropic/claude-opus-4.8"]);
});

test("REQ-120/PROP-107: filterModels(undefined provider) with 'all' returns everything", () => {
  assert.equal(filterModels(catalog, "all", undefined).length, 4);
});

test("REQ-120/PROP-107: filterModels provider filters by id prefix, case-insensitive", () => {
  const out = filterModels(catalog, "all", "OpenAI");
  assert.deepEqual(out.map((m) => m.id).sort(), ["openai/gpt-5.5", "openai/gpt-image-2", "openai/text-embedding-3"].sort());
});
