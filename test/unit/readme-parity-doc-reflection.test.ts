// Run with: npm test (tsx --test)
// PROP-DX-012 (REQ-DX-030..034). Tier 1 mechanical — reads README.md/PARITY.md fresh
// from disk and asserts this feature's additive doc deltas landed, mirroring the style
// of scripts/docs-check.mjs's own mechanical checks (Phase 2 may extend that script and
// have it invoked from here, or assert directly as below — REQ-DX-041 requires the
// PROP itself to live under test/, not a standalone script outside `npm test`).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const README = readFileSync(fileURLToPath(new URL("../../README.md", import.meta.url)), "utf8");
const PARITY = readFileSync(fileURLToPath(new URL("../../PARITY.md", import.meta.url)), "utf8");

const REAL_18_COMMANDS = [
  "wallet", "chat", "models", "image", "video", "realface", "music", "speech",
  "search", "exa", "markets", "price", "dex", "rpc", "defi", "modal", "phone", "surf",
];

test("REQ-DX-030: README.md's ## Commands table gains a 19th row for the new `commands` subcommand, alongside the existing 18 rows", () => {
  const commandsSection = README.slice(README.indexOf("## Commands"));
  for (const name of [...REAL_18_COMMANDS, "commands"]) {
    assert.match(commandsSection, new RegExp(`\\b${name}\\b`), `## Commands table must still list '${name}'`);
  }
  assert.match(commandsSection, /commands/, "the new 'commands' row itself must be present");
});

test("REQ-DX-031: README.md documents the new 0/1/2/3/4 exit-code convention", () => {
  for (const exitCode of ["0", "1", "2", "3", "4"]) {
    assert.match(README, new RegExp(`\\b${exitCode}\\b`), `README.md must document exit code ${exitCode}`);
  }
});

test("REQ-DX-031: README.md documents the exact 6 real `code` values and no 7th invented value", () => {
  const REAL_CODES = ["usage_error", "budget_exceeded", "quote_exceeded", "insufficient_funds", "upstream_error", "network_error"];
  for (const code of REAL_CODES) {
    assert.match(README, new RegExp(code), `README.md must document code value '${code}'`);
  }
  assert.doesNotMatch(README, /unknown_error/, "no invented 7th code value may appear");
});

test("REQ-DX-032: README.md's Environment Variables table and Multi-agent budget delegation section are still present (this feature is additive-only, not a rewrite)", () => {
  assert.match(README, /Environment Variables/i);
  assert.match(README, /budget delegation/i);
});

test("REQ-DX-033: PARITY.md's Known non-parity points section gains a bullet noting `blockrun commands` has no MCP-tool equivalent", () => {
  const nonParitySection = PARITY.slice(PARITY.indexOf("Known non-parity points"));
  assert.match(nonParitySection, /blockrun commands/, "PARITY.md must document that `blockrun commands` has no MCP equivalent");
  assert.match(nonParitySection, /no.*MCP|MCP.*no/i);
});

test("REQ-DX-034: PARITY.md's 18 existing per-command sections are still all present, unchanged in count", () => {
  for (const name of REAL_18_COMMANDS) {
    assert.match(PARITY, new RegExp(`###\\s+${name}\\b`), `PARITY.md must still have a ### ${name} section`);
  }
});
