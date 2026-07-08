// Run with: npm test (tsx --test)
// PROP-DX-014 (REQ-DX-014, -017; added per spec-review it-2 SPEC-DX-4's own suggested
// fix). A static, mechanical, source-text regression guard: EVERY one of the 18
// src/commands/<name>.ts files must contain the literal substring `extractErrorMessage(`
// somewhere in its file (Phase 2's choice of exact AST-vs-textual mechanism; a simple
// whole-file substring check is sufficient given none of the 18 files' catch blocks
// today throw/rethrow anything requiring a narrower per-block scope).
//
// RED-phase note: today (before REQ-DX-017's one-line dex.ts fix) 17 of 18 already
// satisfy this — dex.ts's catch block reads `err.message` directly instead. This test
// is therefore EXPECTED TO FAIL today on dex.ts alone (not on all 18), which is the
// exact gap spec-review it-2 SPEC-DX-4 found and REQ-DX-017 closes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const COMMANDS_DIR = fileURLToPath(new URL("../../src/commands/", import.meta.url));
const COMMAND_FILES = readdirSync(COMMANDS_DIR).filter((f) => f.endsWith(".ts") && f !== "shared.ts");

test("PROP-DX-014: exactly 18 command files are checked", () => {
  assert.equal(COMMAND_FILES.length, 18);
});

for (const file of COMMAND_FILES) {
  test(`PROP-DX-014: src/commands/${file} calls extractErrorMessage( somewhere in its error path`, () => {
    const src = readFileSync(`${COMMANDS_DIR}${file}`, "utf8");
    assert.ok(
      src.includes("extractErrorMessage("),
      `${file} must route its caught errors through extractErrorMessage() (REQ-DX-014/-017) — a raw err.message/String(err) shortcut silently loses network-failure detail (REQ-DX-015)`,
    );
  });
}
