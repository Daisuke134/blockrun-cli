// Run with: npm test (tsx --test)
// PROP-DX-002/003 (REQ-DX-001, -002, -005, -006). Tier 2, live binary. `npm run build`
// must run before `npm test` for this file to have anything to exercise; in the Red
// phase dist/index.js does not exist yet AND the `commands` subcommand does not exist,
// so every spawn here is expected to fail.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CLI_ENTRY = fileURLToPath(new URL("../../dist/index.js", import.meta.url));

const COMMANDS = [
  "wallet", "chat", "models", "image", "video", "realface", "music", "speech",
  "search", "exa", "markets", "price", "dex", "rpc", "defi", "modal", "phone", "surf",
  "commands",
];

function runCli(args: string[], home: string) {
  return spawnSync(process.execPath, [CLI_ENTRY, ...args], {
    encoding: "utf8",
    timeout: 15_000,
    env: { ...process.env, HOME: home },
  });
}

function readLedgerCounters(home: string): { spent: number; calls: number } | null {
  const ledgerPath = join(home, ".blockrun", "cli-budget.json");
  if (!existsSync(ledgerPath)) return null;
  const parsed = JSON.parse(readFileSync(ledgerPath, "utf8")) as { global: { spent: number; calls: number } };
  return { spent: parsed.global.spent, calls: parsed.global.calls };
}

test("PROP-DX-002: `commands --json` exits 0, produces { commands: FlagMeta[] } with exactly 18 real command entries, and makes NO network call / NO spend", () => {
  const home = mkdtempSync(join(tmpdir(), "blockrun-cli-commands-json-"));
  const before = readLedgerCounters(home);
  const res = runCli(["commands", "--json"], home);
  assert.equal(res.status, 0, `stdout: ${res.stdout}\nstderr: ${res.stderr}`);
  const parsed = JSON.parse(res.stdout) as { commands: Array<{ name: string }> };
  assert.ok(Array.isArray(parsed.commands), "expected a `commands` array");
  assert.equal(parsed.commands.length, 18, "the commands catalog itself must list the 18 REAL subcommands (not itself)");
  const names = parsed.commands.map((c) => c.name).sort();
  assert.deepEqual(names, COMMANDS.filter((c) => c !== "commands").sort());
  const after = readLedgerCounters(home);
  if (before && after) {
    assert.equal(after.spent, before.spent, "`commands --json` must be $0 by construction");
    assert.equal(after.calls, before.calls, "`commands --json` must make no network call");
  }
});

test("PROP-DX-003: `commands` (no --json) exits 0 with a human table of 18 rows", () => {
  const home = mkdtempSync(join(tmpdir(), "blockrun-cli-commands-table-"));
  const res = runCli(["commands"], home);
  assert.equal(res.status, 0, `stdout: ${res.stdout}\nstderr: ${res.stderr}`);
  for (const name of COMMANDS.filter((c) => c !== "commands")) {
    assert.match(res.stdout, new RegExp(`\\b${name}\\b`), `human 'commands' table should list '${name}'`);
  }
});

test("PROP-DX-003: `commands --help` exits 0 with Commander's standard help format (no crash, no special-casing bug)", () => {
  const home = mkdtempSync(join(tmpdir(), "blockrun-cli-commands-help-"));
  const res = runCli(["commands", "--help"], home);
  assert.equal(res.status, 0, `stdout: ${res.stdout}\nstderr: ${res.stderr}`);
  assert.match(res.stdout, /Usage:/i);
});

test("REQ-DX-001/PROP-001 regression: `--help` now lists 19 subcommands including 'commands' itself", () => {
  const home = mkdtempSync(join(tmpdir(), "blockrun-cli-help-19-"));
  const res = runCli(["--help"], home);
  assert.equal(res.status, 0, `stdout: ${res.stdout}\nstderr: ${res.stderr}`);
  for (const name of COMMANDS) {
    assert.match(res.stdout, new RegExp(`\\b${name}\\b`), `--help should list '${name}'`);
  }
});
