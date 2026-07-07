// Run with: npm test (tsx --test)
// Verbatim port of blockrun-mcp's body.test.ts — src/core/body.ts is a byte-for-byte
// port of the clone's src/utils/body.ts (verification-architecture.md §1.1). Feeds
// REQ-004 (structured --body input) and the path-based passthrough commands.
import { test } from "node:test";
import assert from "node:assert/strict";
import { asStructuredContent, coerceBody } from "../../src/core/body.js";

test("coerceBody parses JSON strings to objects", () => {
  assert.deepEqual(coerceBody('{"a":1}'), { a: 1 });
  assert.deepEqual(coerceBody("[1,2,3]"), [1, 2, 3]);
});

test("coerceBody returns non-strings untouched (real empty object stays a POST body)", () => {
  const obj = {};
  assert.equal(coerceBody(obj), obj);
  assert.equal(coerceBody(undefined), undefined);
  const arr = [{ jsonrpc: "2.0" }];
  assert.equal(coerceBody(arr), arr);
});

test("coerceBody maps an empty/whitespace string to undefined, not {}", () => {
  assert.equal(coerceBody(""), undefined);
  assert.equal(coerceBody("   "), undefined);
  assert.equal(coerceBody("\n\t"), undefined);
});

test("coerceBody leaves non-JSON strings as-is for the gateway to reject", () => {
  assert.equal(coerceBody("not json"), "not json");
});

test("asStructuredContent passes objects through, wraps arrays/primitives", () => {
  const obj = { ok: true };
  assert.equal(asStructuredContent(obj), obj);
  assert.deepEqual(asStructuredContent([1, 2]), { result: [1, 2] });
  assert.deepEqual(asStructuredContent("hi"), { result: "hi" });
  assert.deepEqual(asStructuredContent(null), { result: null });
  assert.deepEqual(asStructuredContent(42), { result: 42 });
});
