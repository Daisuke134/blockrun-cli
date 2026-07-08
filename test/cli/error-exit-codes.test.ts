// Run with: npm test (tsx --test)
// PROP-DX-008 (REQ-DX-010, -012). Tier 2, live binary, two REAL live-triggered error
// invocations — NO network call, NO spend, by construction (both reject locally before
// any network call). `npm run build` must run before `npm test`; in the Red phase
// dist/index.js does not exist yet, so both spawns are expected to fail.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CLI_ENTRY = fileURLToPath(new URL("../../dist/index.js", import.meta.url));

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

test("PROP-DX-008 (1): `rpc --network \"../bad\"` (known-malformed slug, REQ-201) exits 2 with code 'usage_error' — no network call", () => {
  const home = mkdtempSync(join(tmpdir(), "blockrun-cli-usage-error-"));
  const before = readLedgerCounters(home);
  const res = runCli(["rpc", "--network", "../bad", "--method", "eth_blockNumber", "--json"], home);
  assert.equal(res.status, 2, `expected exit 2 (usage_error) — stdout: ${res.stdout}\nstderr: ${res.stderr}`);
  const parsed = JSON.parse(res.stdout) as { code?: string };
  assert.equal(parsed.code, "usage_error");
  const after = readLedgerCounters(home);
  if (before && after) {
    assert.equal(after.spent, before.spent, "a usage_error must reject before any network call");
    assert.equal(after.calls, before.calls);
  }
});

test("PROP-DX-008 (2): `defi --path prices/coingecko:bitcoin --budget-limit 0.0000001` (ephemeral cap below the known $0.001 estimate) exits 2 with code 'budget_exceeded' — cli-budget.json unchanged before/after", () => {
  const home = mkdtempSync(join(tmpdir(), "blockrun-cli-budget-exceeded-"));
  const before = readLedgerCounters(home);
  const res = runCli(
    ["defi", "--path", "prices/coingecko:bitcoin", "--budget-limit", "0.0000001", "--json"],
    home,
  );
  assert.equal(res.status, 2, `expected exit 2 (budget_exceeded) — stdout: ${res.stdout}\nstderr: ${res.stderr}`);
  const parsed = JSON.parse(res.stdout) as { code?: string };
  assert.equal(parsed.code, "budget_exceeded");
  const after = readLedgerCounters(home);
  if (before && after) {
    assert.equal(after.spent, before.spent, "budget_exceeded must reject before any network call — money-safety");
    assert.equal(after.calls, before.calls);
  }
});
