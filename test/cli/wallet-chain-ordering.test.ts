// Run with: npm test (tsx --test)
// REQ-016/REQ-016a, impl-review FIND-007 (real-fs regression — see
// src/commands/wallet.ts's `chain` action comment and src/shell/wallet.ts's
// peekSolanaWallet()/ensureBaseWallet()). This must use the REAL built binary
// against a REAL, freshly-created isolated HOME — every other wallet test in this
// suite mocks src/shell/wallet.js entirely, which hides this bug completely (the
// mocked getChain never reads a real .solana-session file, so file-creation
// ordering never mattered there).
//
// The bug (now fixed by REQ-016a's on-demand Solana wallet creation): the ORIGINAL
// code unconditionally called ensureBothWallets() (which auto-creates
// ~/.blockrun/.solana-session) for EVERY `wallet chain` call, including view-only
// ones with no --chain flag. getChain()'s auto-detection rule 3 ("non-empty
// .solana-session exists -> solana") would then fire on that just-created file —
// so a fresh user's very first `wallet chain` call (even read-only) would
// permanently reroute their default chain to Solana, breaking every Base-only
// paid command (video/music/speech/realface) from then on, forever, since the
// file persists across all future invocations too.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CLI_ENTRY = fileURLToPath(new URL("../../dist/index.js", import.meta.url));

function runCli(args: string[], home: string) {
  return spawnSync(process.execPath, [CLI_ENTRY, ...args], {
    encoding: "utf8",
    timeout: 20_000,
    env: { ...process.env, HOME: home },
  });
}

test("FIND-007: `wallet --action chain` (view-only, no --chain flag) on a completely fresh HOME reports 'base', not 'solana'", () => {
  const home = mkdtempSync(join(tmpdir(), "blockrun-cli-chain-ordering-"));
  const res = runCli(["wallet", "--action", "chain", "--json"], home);
  assert.equal(res.status, 0, `stdout: ${res.stdout}\nstderr: ${res.stderr}`);
  const parsed = JSON.parse(res.stdout);
  assert.equal(parsed.activeChain, "base", "a fresh HOME with no chain preference must default to base, not be flipped to solana by ensureBothWallets()'s own side effect");
  assert.equal(parsed.solana, null, "REQ-016a: a view-only call must not create a Solana wallet, so its address is reported as null, not fabricated");
});

test("REQ-016a: REPEATED view-only `wallet --action chain` calls on the SAME HOME all report 'base' — no Solana wallet is ever auto-created by view-only calls", () => {
  const home = mkdtempSync(join(tmpdir(), "blockrun-cli-chain-ordering-repeat-"));
  for (let i = 0; i < 3; i++) {
    const res = runCli(["wallet", "--action", "chain", "--json"], home);
    assert.equal(res.status, 0, `call #${i + 1} — stdout: ${res.stdout}\nstderr: ${res.stderr}`);
    const parsed = JSON.parse(res.stdout);
    assert.equal(parsed.activeChain, "base", `call #${i + 1} must still report base`);
    assert.equal(parsed.solana, null, `call #${i + 1}: no Solana wallet should exist yet`);
  }
});

test("REQ-016a: REPEATED `wallet` (default status action) calls on the SAME HOME all report 'base' — status must not create a Solana wallet either", () => {
  // Regression for the exact scenario the reviewer caught live: `status` also calls
  // ensureBothWallets() unconditionally before this fix, so a first `wallet` call
  // would create ~/.blockrun/.solana-session, permanently flipping every SUBSEQUENT
  // invocation (of ANY command, not just wallet) to Solana via REQ-016 rule 3.
  const home = mkdtempSync(join(tmpdir(), "blockrun-cli-status-ordering-repeat-"));
  for (let i = 0; i < 3; i++) {
    const res = runCli(["wallet", "--json"], home);
    assert.equal(res.status, 0, `call #${i + 1} — stdout: ${res.stdout}\nstderr: ${res.stderr}`);
    const parsed = JSON.parse(res.stdout);
    assert.equal(parsed.activeChain, "base", `call #${i + 1} must still report base`);
    assert.equal(parsed.solana, null, `call #${i + 1}: no Solana wallet should exist yet`);
  }
});

test("FIND-007 follow-up: an EXPLICIT --chain base switch still wins over rule-3 auto-detection once a Solana wallet exists", () => {
  const home = mkdtempSync(join(tmpdir(), "blockrun-cli-chain-ordering-explicit-"));
  const first = runCli(["wallet", "--action", "chain", "--json"], home);
  assert.equal(first.status, 0, `stdout: ${first.stdout}\nstderr: ${first.stderr}`);
  assert.equal(JSON.parse(first.stdout).activeChain, "base", "first-ever call on a fresh HOME must report base");

  // Explicitly switch to solana (creates the Solana wallet — REQ-016a's ONE legitimate
  // on-demand-creation trigger), then explicitly switch back to base.
  const toSolana = runCli(["wallet", "--action", "chain", "--chain", "solana", "--json"], home);
  assert.equal(toSolana.status, 0, `stdout: ${toSolana.stdout}\nstderr: ${toSolana.stderr}`);
  assert.equal(JSON.parse(toSolana.stdout).activeChain, "solana");

  const backToBase = runCli(["wallet", "--action", "chain", "--chain", "base", "--json"], home);
  assert.equal(backToBase.status, 0, `stdout: ${backToBase.stdout}\nstderr: ${backToBase.stderr}`);
  assert.equal(JSON.parse(backToBase.stdout).activeChain, "base");

  // A view-only call (no --chain flag) must still report base — the explicit
  // preference file (REQ-016 rule 1) outranks rule 3's solana-session autodetect,
  // even though a REAL Solana wallet now genuinely exists on disk.
  const viewOnly = runCli(["wallet", "--action", "chain", "--json"], home);
  assert.equal(viewOnly.status, 0, `stdout: ${viewOnly.stdout}\nstderr: ${viewOnly.stderr}`);
  assert.equal(JSON.parse(viewOnly.stdout).activeChain, "base", "an explicit .chain preference must outrank rule-3 auto-detection on later view-only calls");
});
