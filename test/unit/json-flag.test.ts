// Run with: npm test (tsx --test)
// PROP-003 (REQ-004). Structured (object/array-typed) flags accept EITHER
// `--param-json '<json>'` (a raw JSON string) OR `--param @file.json` (a file
// reference). Both forms funnel through the same parseJsonInput() so
// args/<command>.ts sees one already-decoded value regardless of which form the
// caller used (decisions.md §4).
import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseJsonInput } from "../../src/cli/json-flag.js";

test("REQ-004: parseJsonInput parses a raw JSON string (the --param-json form)", () => {
  assert.deepEqual(parseJsonInput('{"a":1}'), { a: 1 });
  assert.deepEqual(parseJsonInput("[1,2,3]"), [1, 2, 3]);
});

test("REQ-004: parseJsonInput reads and parses a file when the value starts with '@' (the --param @file.json form)", () => {
  const file = join(tmpdir(), `blockrun-cli-json-flag-test-${Date.now()}.json`);
  writeFileSync(file, JSON.stringify({ messages: [{ role: "user", content: "hi" }] }));
  try {
    const viaInline = parseJsonInput('{"messages":[{"role":"user","content":"hi"}]}');
    const viaFile = parseJsonInput(`@${file}`);
    assert.deepEqual(viaFile, viaInline, "--param-json and --param @file.json must normalize to the same parsed value");
  } finally {
    unlinkSync(file);
  }
});

test("REQ-004: parseJsonInput throws a clear error on malformed JSON (not a silent undefined)", () => {
  assert.throws(() => parseJsonInput("{not json"));
});

test("REQ-004: parseJsonInput throws when the referenced file does not exist", () => {
  assert.throws(() => parseJsonInput("@/nonexistent/path/blockrun-cli-missing.json"));
});
