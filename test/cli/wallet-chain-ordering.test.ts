// Run with: npm test (tsx --test)
// REQ-016, impl-review FIND-007 (real-fs regression — see src/commands/wallet.ts's
// `chain` action comment). This must use the REAL built binary against a REAL,
// freshly-created isolated HOME — every other wallet test in this suite mocks
// src/shell/wallet.js entirely, which hides this bug completely (the mocked getChain
// never reads a real .solana-session file, so the ordering never mattered there).
//
// The bug: ensureBothWallets() auto-creates ~/.blockrun/.solana-session on first run.
// getChain()'s auto-detection rule 3 ("non-empty .solana-session exists -> solana")
// then fires on the file THIS invocation just created — so calling `wallet --action
// chain` (even a view-only call, no --chain flag) on a completely fresh HOME would
// permanently report/default to Solana instead of Base, even though the user never
// expressed a chain preference and has no .chain preference file.
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
});

// NOTE on scope: a SECOND `wallet --action chain` call (no --chain flag) on the SAME
// HOME legitimately reports "solana" once both wallet files exist on disk — that is
// REQ-016's rule 3 ("non-empty .solana-session exists -> solana") firing on a REAL,
// now-persisted file, exactly as the verbatim-ported precedence specifies. That is
// NOT the FIND-007 bug (which was this invocation's OWN read being contaminated by
// its OWN ensureBothWallets() side effect, fixed above) — it is REQ-016's literal,
// intentional cross-invocation auto-detection behavior (inherited from
// blockrun-mcp), which this CLI must not silently reinterpret. What the fix DOES
// guarantee is that REQ-016's rule 1 (an explicit .chain preference) still wins over
// that auto-detection, proven below.
test("FIND-007 follow-up: an EXPLICIT --chain base switch still wins over rule-3 auto-detection once both wallet files exist", () => {
  const home = mkdtempSync(join(tmpdir(), "blockrun-cli-chain-ordering-explicit-"));
  const first = runCli(["wallet", "--action", "chain", "--json"], home);
  assert.equal(first.status, 0, `stdout: ${first.stdout}\nstderr: ${first.stderr}`);
  assert.equal(JSON.parse(first.stdout).activeChain, "base", "first-ever call on a fresh HOME must report base");

  // Explicitly re-affirm base — this writes ~/.blockrun/.chain, REQ-016's rule 1.
  const second = runCli(["wallet", "--action", "chain", "--chain", "base", "--json"], home);
  assert.equal(second.status, 0, `stdout: ${second.stdout}\nstderr: ${second.stderr}`);
  assert.equal(JSON.parse(second.stdout).activeChain, "base");

  // A THIRD, view-only call (no --chain flag) must still report base — the explicit
  // preference file from the second call outranks rule 3's solana-session autodetect.
  const third = runCli(["wallet", "--action", "chain", "--json"], home);
  assert.equal(third.status, 0, `stdout: ${third.stdout}\nstderr: ${third.stderr}`);
  assert.equal(JSON.parse(third.stdout).activeChain, "base", "an explicit .chain preference must outrank rule-3 auto-detection on later view-only calls");
});
