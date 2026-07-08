// Run with: npm test (tsx --test)
// PROP-DX-007 (REQ-DX-014). A single shared classification function must be called
// from EVERY ONE of the 18 commands/<name>.ts error paths, not reimplemented per-command.
// Since all 18 already call the shared fail() (src/core/render.ts), the cleanest proof is
// that fail() ITSELF computes `code` via ONE shared classifier — which does not exist yet
// (Red phase, fails on the classifyErrorCode-derived assertion below) — combined with a
// static regression guard that no command file duplicates the classification patterns.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { fail } from "../../src/core/render.js";

const COMMANDS_DIR = fileURLToPath(new URL("../../src/commands/", import.meta.url));
const COMMAND_FILES = readdirSync(COMMANDS_DIR).filter((f) => f.endsWith(".ts") && f !== "shared.ts");

test("PROP-DX-007: exactly 18 command files exist besides shared.ts", () => {
  assert.equal(COMMAND_FILES.length, 18);
});

test("PROP-DX-007: fail()'s JSON output carries `code` derived from the shared classifier — this is what makes classification 'called from every one of the 18 commands' error paths' for free, since all 18 already call fail()", () => {
  const out = fail("Model 'x' not found or not active for requested provider", true);
  const parsed = JSON.parse(out.stdout) as { code?: string };
  assert.equal(parsed.code, "upstream_error", "fail() itself must compute code via the ONE shared classifier (REQ-DX-014), not leave it to each command");
});

for (const file of COMMAND_FILES) {
  test(`PROP-DX-007: src/commands/${file} does not reimplement its OWN error-code classification logic (no duplicate pattern strings outside core/errors.ts)`, () => {
    const src = readFileSync(`${COMMANDS_DIR}${file}`, "utf8");
    const forbiddenPatterns = [
      "not found or not active",
      "ECONNREFUSED",
      "ENOTFOUND",
      "isModelUnavailable",
      "isServerError",
      "isPaymentError",
      "hasStatus(",
    ];
    for (const forbidden of forbiddenPatterns) {
      assert.ok(
        !src.includes(forbidden),
        `${file} must not duplicate classification pattern '${forbidden}' — all classification lives in ONE shared function (REQ-DX-014), never reimplemented per-command`,
      );
    }
  });
}
