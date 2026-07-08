// Run with: npm test (tsx --test)
// PROP-DX-009 (REQ-DX-020, -021, -022, -023). Tier 2, live binary against the REAL,
// currently-live sandbox HOME from the blockrun-cli-docs feature — a CONDITIONAL live
// assertion, since the real RPC outcome on any given day is not under this test's
// control. `npm run build` must run before `npm test`; in the Red phase dist/index.js
// does not exist yet, so this spawn is expected to fail outright (ENOENT / nonzero
// exit), which trivially satisfies "conditional" by never reaching either branch —
// the FIRST assertion (exit 0) is what makes this genuinely Red-phase-failing.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const CLI_ENTRY = fileURLToPath(new URL("../../dist/index.js", import.meta.url));
const SANDBOX_HOME = "/Users/anicca/blockrun-cli-e2e-home";

function runCli(args: string[]) {
  return spawnSync(process.execPath, [CLI_ENTRY, ...args], {
    encoding: "utf8",
    timeout: 20_000,
    env: { ...process.env, HOME: SANDBOX_HOME },
  });
}

test("PROP-DX-009: `wallet --action status --json` against the live sandbox — IF base.balance is null THEN base.balanceUnavailableReason is 'all_rpcs_failed', ELSE the key is absent (same conditional for solana)", () => {
  const res = runCli(["wallet", "--action", "status", "--json"]);
  assert.equal(res.status, 0, `stdout: ${res.stdout}\nstderr: ${res.stderr}`);
  const parsed = JSON.parse(res.stdout) as {
    base: { balance: number | null; balanceUnavailableReason?: string };
    solana: { balance: number | null; balanceUnavailableReason?: string } | null;
  };

  if (parsed.base.balance === null) {
    assert.equal(parsed.base.balanceUnavailableReason, "all_rpcs_failed");
  } else {
    assert.equal("balanceUnavailableReason" in parsed.base, false, "a real Base balance must not carry a reason key");
  }

  if (parsed.solana && parsed.solana.balance === null) {
    assert.equal(parsed.solana.balanceUnavailableReason, "solana_client_error");
  } else if (parsed.solana) {
    assert.equal("balanceUnavailableReason" in parsed.solana, false, "a real Solana balance must not carry a reason key");
  }
});
